/**
 * Azure AI Foundry **Agent Service** adapter.
 *
 * The difference from `foundry-adapter.ts` is not the model, it is who decides
 * what to retrieve. That adapter pre-fetches grounding and hands the model a
 * single prompt; this one registers a `search_florida_law` tool and lets the
 * agent decide when to call it, and how many times, before answering.
 *
 * The safety story is unchanged, and deliberately so. The tool is the *only*
 * way legal material enters the conversation, and it runs the same
 * `gatherGrounding` the other two adapters use — retrieval stays in this
 * repository, over a corpus committed to it and covered by tests. An agent
 * that answers without calling the tool is answering from training data, so
 * that case is detected and refused rather than shown.
 *
 * ## Why this targets the v2 Agents API rather than `/assistants`
 *
 * The original implementation used the Assistants-style API: create a thread,
 * add a message, start a run, poll it, submit tool outputs. Foundry now labels
 * agents created that way **"Classic agents"** in the portal and describes the
 * API as superseded. This adapter therefore targets the current API:
 *
 * - agents are managed at `/agents?api-version=v1` and are **versioned**,
 * - agents are referenced **by name**, not by an opaque `asst_…` id,
 * - a run is one synchronous `POST /openai/v1/responses` call rather than a
 *   thread plus a polling loop, which removes the polling entirely.
 *
 * Conversation history is replayed into each request instead of being held on
 * a server-side thread. That is the same decision the thread-based version
 * made and for the same reason: a stored thread would outlive the request and
 * become conversation content retained outside this app's own retention rules.
 * The `previous_response_id` returned by a call is used only to continue a
 * single in-flight tool loop, never across user turns.
 *
 * Model choice is a constraint, not a preference. The Agent Service always
 * sends `top_p`, which gpt-5.5 and the whole gpt-5.6 family reject with
 * `invalid_prompt`. That was verified against a live resource across five API
 * versions, and cannot be configured away by passing the parameter explicitly.
 * gpt-5.1 accepts it, so the agent runs gpt-5.1 while the chat-completions
 * adapter keeps the newer model. Substance comes from the corpus either way.
 */

import { DefaultAzureCredential, ManagedIdentityCredential, type TokenCredential } from "@azure/identity";

import { getServerEnv } from "@/lib/env";

import {
  AssistantProviderUnavailableError,
  type AssistantAdapter,
  type AssistantAnswer,
  type AssistantRequest,
} from "./adapter";
import { FoundryAssistantAdapter } from "./foundry-adapter";
import { citationsUsedIn, gatherGrounding, isUngrounded, type Grounding } from "./grounding";
import {
  detectEscalationSignals,
  encloseUntrustedText,
  redactCurrency,
  scanForCalculatedFigures,
  scanForPromptInjection,
} from "./guardrails";
import { AGENT_INSTRUCTIONS } from "./systemPrompt";

/** Entra scope for the Foundry project data plane. Not the same as the OpenAI one. */
const AGENT_TOKEN_SCOPE = "https://ai.azure.com/.default";

/** Whole-conversation budget. A run is several HTTP round trips, not one. */
const RUN_TIMEOUT_MS = 60_000;

/**
 * A run alternates between "thinking" and "waiting for tool output". This caps
 * the number of tool rounds so a model that keeps re-searching cannot spin.
 */
const MAX_TOOL_ROUNDS = 4;

const SEARCH_TOOL = "search_florida_law";

/**
 * Exported so `scripts/create-foundry-agent.ts` registers the *same* tool the
 * adapter expects to be called back on. A second copy in the script would be a
 * silent drift risk: the agent visible in the portal could advertise a tool the
 * running code never answers.
 *
 * Note the shape differs from the Assistants API, which nested these under a
 * `function` object. The v2 Agents API takes the fields flattened.
 */
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    name: SEARCH_TOOL,
    description:
      "Search verified Florida Chapter 61 statutory text and plain-language explanations. " +
      "You MUST call this before answering any question about Florida family law, and you may " +
      "only state what it returns. It is the sole source of legal content.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The legal question or topic to look up, in plain language.",
        },
      },
      required: ["query"],
    },
  },
] as const;

/** A tool call the agent asked for, as it appears in a response's output list. */
interface FunctionCall {
  readonly type: "function_call";
  readonly call_id: string;
  readonly name: string;
  readonly arguments: string;
}

interface MessageOutput {
  readonly type: "message";
  readonly content?: readonly { readonly text?: string }[];
}

type OutputItem = FunctionCall | MessageOutput | { readonly type: string };

interface AgentResponse {
  readonly id: string;
  readonly status?: string;
  readonly error?: { readonly code?: string; readonly message?: string } | null;
  readonly output?: readonly OutputItem[];
}

/**
 * The agent is looked up by name, so the bootstrap script and the adapter must
 * derive it identically or the app would create a second, duplicate agent
 * alongside the one the user sees in the portal.
 *
 * The v2 API constrains names to alphanumerics and interior hyphens, up to 63
 * characters — so a model id like `gpt-5.1` cannot be interpolated verbatim.
 * Every other run of characters is collapsed to a hyphen rather than dropped,
 * so two different models cannot collide on one name.
 */
export function agentNameFor(model: string): string {
  const slug = `florida-support-guide-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 63).replace(/-+$/, "");
}

export class FoundryAgentAssistantAdapter implements AssistantAdapter {
  readonly name = "foundry-agent";
  readonly label = "Azure AI Foundry agent, grounded in Florida statutes";

  /** Degrades to the chat-completions adapter, which degrades to local. */
  private readonly fallback = new FoundryAssistantAdapter();
  private credential: TokenCredential | undefined;
  private agentNamePromise: Promise<string> | undefined;

  async answer(request: AssistantRequest): Promise<AssistantAnswer> {
    const escalations = detectEscalationSignals(request.question);

    if (scanForPromptInjection(request.question).detected) {
      return this.fallback.answer(request);
    }

    // Retrieved up front as well as by the tool. Two reasons: an ungrounded
    // question needs no agent run at all, and the grounding gathered here is
    // what citations are checked against, so a tool result cannot widen the
    // set of sources the answer is allowed to claim.
    const grounding = gatherGrounding(request.question, request.topic);
    if (isUngrounded(grounding)) {
      return this.fallback.answer(request);
    }

    let result: { text: string; searched: boolean };
    try {
      result = await this.runAgent(request);
    } catch (error) {
      // Only the error's own message, which this adapter composes from a status
      // code and a request path. The question, the answer, and any response
      // body are deliberately excluded: a body can echo back what the person
      // typed, which is financial detail this app does not log. Without this
      // line a provider outage is indistinguishable from a working fallback,
      // which is exactly the state that made the first live failure opaque.
      console.warn(
        `[assistant] Foundry agent unavailable, falling back: ${
          error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"
        }`,
      );
      const fallbackAnswer = await this.fallback.answer(request);
      return {
        ...fallbackAnswer,
        guardrailNote:
          "The AI agent was unavailable, so this answer came from the app's statute reference instead.",
      };
    }

    // An answer produced without calling the search tool was not grounded in
    // the corpus, whatever it happens to say. Showing it would mean showing
    // recalled training data with this app's name on it.
    if (!result.searched) {
      const fallbackAnswer = await this.fallback.answer(request);
      return {
        ...fallbackAnswer,
        guardrailNote:
          "The AI agent answered without consulting the verified Florida material, so its response was " +
          "discarded and this answer came from the app's statute reference instead.",
      };
    }

    if (scanForCalculatedFigures(result.text).containsCurrency) {
      const fallbackAnswer = await this.fallback.answer(request);
      return {
        ...fallbackAnswer,
        guardrailNote:
          "The AI response was replaced because it contained a dollar figure. Every figure in this app comes " +
          "from its own deterministic calculators.",
      };
    }

    return {
      content: result.text.trim(),
      citations: citationsUsedIn(result.text, grounding),
      escalations,
      groundedIn: [
        ...grounding.entries.map((hit) => hit.entry.id),
        ...grounding.statutes.map((hit) => hit.chunk.id),
      ],
      source: this.label,
      outOfScope: false,
    };
  }

  private getCredential(): TokenCredential {
    this.credential ??= process.env.IDENTITY_ENDPOINT
      ? new ManagedIdentityCredential()
      : new DefaultAzureCredential();
    return this.credential;
  }

  private config() {
    const env = getServerEnv();
    if (!env.AZURE_FOUNDRY_PROJECT_ENDPOINT || !env.AZURE_FOUNDRY_AGENT_MODEL) {
      throw new AssistantProviderUnavailableError(
        "ASSISTANT_PROVIDER=agent requires AZURE_FOUNDRY_PROJECT_ENDPOINT and AZURE_FOUNDRY_AGENT_MODEL.",
      );
    }
    return {
      endpoint: env.AZURE_FOUNDRY_PROJECT_ENDPOINT.replace(/\/$/, ""),
      model: env.AZURE_FOUNDRY_AGENT_MODEL,
      apiVersion: env.AZURE_FOUNDRY_AGENT_API_VERSION,
    };
  }

  private async request<T>(url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
    const token = await this.getCredential().getToken(AGENT_TOKEN_SCOPE, { abortSignal: signal });
    if (!token) {
      throw new AssistantProviderUnavailableError(
        "Could not acquire an Entra ID token for the Foundry project. Ensure the app's identity holds " +
          "Azure AI Developer (or equivalent) on the Foundry account.",
      );
    }

    const response = await fetch(url, {
      ...init,
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token.token}`,
        ...init.headers,
      },
    });

    if (!response.ok) {
      // The body is not included: it can echo the person's question, which may
      // contain sensitive financial detail. Only the path is reported, and the
      // query string is stripped so nothing user-derived can reach a log.
      throw new AssistantProviderUnavailableError(
        `Azure AI Foundry Agent Service returned status ${response.status} for ${new URL(url).pathname}.`,
      );
    }
    return (await response.json()) as T;
  }

  /**
   * Agents are data-plane objects with no ARM representation, so they cannot be
   * created by Bicep. This creates one on first use and reuses it by name
   * afterwards, which keeps deployment to a single `git push` and avoids a
   * bootstrap step that could be skipped.
   *
   * It resolves to the agent *name*: the v2 API references agents by name and
   * version rather than by an opaque id.
   */
  private async ensureAgent(signal: AbortSignal): Promise<string> {
    this.agentNamePromise ??= (async () => {
      const { endpoint, model, apiVersion } = this.config();
      const name = agentNameFor(model);
      const url = `${endpoint}/agents?api-version=${encodeURIComponent(apiVersion)}`;

      const existing = await this.request<{ data?: readonly { name?: string }[] }>(
        url,
        { method: "GET" },
        signal,
      );
      if (existing.data?.some((agent) => agent.name === name)) return name;

      await this.request(
        url,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            definition: {
              kind: "prompt",
              model,
              instructions: AGENT_INSTRUCTIONS,
              tools: TOOL_DEFINITIONS,
            },
          }),
        },
        signal,
      );
      return name;
    })().catch((error: unknown) => {
      // Never cache a failure: a transient error at startup would otherwise
      // disable the agent for the process lifetime.
      this.agentNamePromise = undefined;
      throw error;
    });

    return this.agentNamePromise;
  }

  /**
   * Runs the tool loop. Returns the answer and whether the agent actually
   * consulted the corpus, which the caller treats as a precondition for
   * showing anything the agent said.
   */
  private async runAgent(request: AssistantRequest): Promise<{ text: string; searched: boolean }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);

    try {
      const signal = controller.signal;
      const { endpoint } = this.config();
      const name = await this.ensureAgent(signal);
      // The Responses endpoint is versionless and sits under a different path
      // prefix from agent management, which is why URLs are built per call.
      const url = `${endpoint}/openai/v1/responses`;
      const agentReference = { type: "agent_reference", name };

      // Prior turns are replayed rather than held on a server-side thread, so
      // no conversation content is retained by Foundry between requests.
      let input: unknown[] = [
        ...request.history.map((message) => ({
          type: "message",
          role: message.role === "user" ? "user" : "assistant",
          content:
            message.role === "user" ? encloseUntrustedText(message.content) : message.content,
        })),
        {
          type: "message",
          role: "user",
          content: encloseUntrustedText(request.question),
        },
      ];

      let response = await this.request<AgentResponse>(
        url,
        { method: "POST", body: JSON.stringify({ agent_reference: agentReference, input }) },
        signal,
      );

      let searched = false;

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        const calls = (response.output ?? []).filter(
          (item): item is FunctionCall => item.type === "function_call",
        );
        if (calls.length === 0) break;

        input = calls.map((call) => {
          if (call.name !== SEARCH_TOOL) {
            return {
              type: "function_call_output",
              call_id: call.call_id,
              output: JSON.stringify({ error: "Unknown tool." }),
            };
          }
          searched = true;
          return {
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify(this.search(call.arguments, request)),
          };
        });

        response = await this.request<AgentResponse>(
          url,
          {
            method: "POST",
            body: JSON.stringify({
              agent_reference: agentReference,
              previous_response_id: response.id,
              input,
            }),
          },
          signal,
        );
      }

      if (response.error) {
        throw new AssistantProviderUnavailableError(
          `Agent run failed${response.error.code ? ` (${response.error.code})` : ""}.`,
        );
      }

      const text = (response.output ?? [])
        .filter((item): item is MessageOutput => item.type === "message")
        .flatMap((message) => message.content ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new AssistantProviderUnavailableError("Agent run produced no answer.");
      }

      return { text, searched };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * The tool body. Runs the same retrieval the other adapters use, so the agent
   * cannot reach material they could not. Currency is redacted here rather than
   * only on the way out: the guarantee that this assistant never states a
   * dollar figure is easiest to keep when the model never reads one.
   */
  private search(rawArguments: string, request: AssistantRequest) {
    let query = request.question;
    try {
      const parsed = JSON.parse(rawArguments) as { query?: unknown };
      if (typeof parsed.query === "string" && parsed.query.trim()) {
        query = parsed.query;
      }
    } catch {
      // A malformed tool call falls back to the person's own question, which is
      // a strictly safer query than anything that could have been in there.
    }

    const grounding: Grounding = gatherGrounding(query, request.topic);

    if (isUngrounded(grounding)) {
      return {
        found: false,
        instruction:
          "No verified Florida material matched. Tell the person you do not have verified material on " +
          "that and suggest they ask a licensed Florida family-law attorney. Do not answer from memory.",
      };
    }

    return {
      found: true,
      instruction:
        "Answer only from these passages. Cite the section numbers shown. Never state a dollar figure.",
      explanations: grounding.entries.map((hit) => ({
        title: hit.entry.title,
        text: redactCurrency(hit.entry.answer),
        citations: hit.entry.citations.map((citation) => citation.citation),
      })),
      statutes: grounding.statutes.map((hit) => ({
        citation: hit.chunk.citation,
        heading: hit.chunk.sectionTitle,
        text: redactCurrency(hit.chunk.text),
      })),
    };
  }
}
