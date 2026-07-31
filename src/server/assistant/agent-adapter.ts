/**
 * Azure AI Foundry **Agent Service** adapter.
 *
 * The difference from `foundry-adapter.ts` is not the model, it is who decides
 * what to retrieve. That adapter pre-fetches grounding and hands the model a
 * single prompt; this one registers a `search_florida_law` tool and lets the
 * agent decide when to call it, on a server-side thread that carries the
 * conversation. That is what makes follow-ups like "and what if there were
 * three children?" work without the client replaying the whole history.
 *
 * The safety story is unchanged, and deliberately so. The tool is the *only*
 * way legal material enters the conversation, and it runs the same
 * `gatherGrounding` the other two adapters use — retrieval stays in this
 * repository, over a corpus committed to it and covered by tests. An agent
 * that answers without calling the tool is answering from training data, so
 * that case is detected and refused rather than shown.
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
const POLL_INTERVAL_MS = 700;

/**
 * A run alternates between "thinking" and "waiting for tool output". This caps
 * the number of tool rounds so a model that keeps re-searching cannot spin.
 */
const MAX_TOOL_ROUNDS = 4;

const SEARCH_TOOL = "search_florida_law";

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
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
  },
] as const;

interface ToolCall {
  readonly id: string;
  readonly function: { readonly name: string; readonly arguments: string };
}

interface Run {
  readonly id: string;
  readonly status: string;
  readonly last_error?: { readonly code?: string; readonly message?: string } | null;
  readonly required_action?: {
    readonly submit_tool_outputs?: { readonly tool_calls?: readonly ToolCall[] };
  } | null;
}

export class FoundryAgentAssistantAdapter implements AssistantAdapter {
  readonly name = "foundry-agent";
  readonly label = "Azure AI Foundry agent, grounded in Florida statutes";

  /** Degrades to the chat-completions adapter, which degrades to local. */
  private readonly fallback = new FoundryAssistantAdapter();
  private credential: TokenCredential | undefined;
  private agentIdPromise: Promise<string> | undefined;

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

  private async request<T>(path: string, init: RequestInit, signal: AbortSignal): Promise<T> {
    const { endpoint, apiVersion } = this.config();
    const token = await this.getCredential().getToken(AGENT_TOKEN_SCOPE, { abortSignal: signal });
    if (!token) {
      throw new AssistantProviderUnavailableError(
        "Could not acquire an Entra ID token for the Foundry project. Ensure the app's identity holds " +
          "Azure AI Developer (or equivalent) on the Foundry account.",
      );
    }

    const response = await fetch(`${endpoint}${path}?api-version=${encodeURIComponent(apiVersion)}`, {
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
      // contain sensitive financial detail.
      throw new AssistantProviderUnavailableError(
        `Azure AI Foundry Agent Service returned status ${response.status} for ${path}.`,
      );
    }
    return (await response.json()) as T;
  }

  /**
   * Agents are data-plane objects with no ARM representation, so they cannot be
   * created by Bicep. This creates one on first use and reuses it by name
   * afterwards, which keeps deployment to a single `git push` and avoids a
   * bootstrap step that could be skipped.
   */
  private async ensureAgent(signal: AbortSignal): Promise<string> {
    this.agentIdPromise ??= (async () => {
      const { model } = this.config();
      const name = `florida-support-guide-${model}`;

      const existing = await this.request<{ data?: readonly { id: string; name?: string }[] }>(
        "/assistants",
        { method: "GET" },
        signal,
      );
      const found = existing.data?.find((agent) => agent.name === name);
      if (found) return found.id;

      const created = await this.request<{ id: string }>(
        "/assistants",
        {
          method: "POST",
          body: JSON.stringify({
            model,
            name,
            instructions: AGENT_INSTRUCTIONS,
            tools: TOOL_DEFINITIONS,
          }),
        },
        signal,
      );
      return created.id;
    })().catch((error: unknown) => {
      // Never cache a failure: a transient error at startup would otherwise
      // disable the agent for the process lifetime.
      this.agentIdPromise = undefined;
      throw error;
    });

    return this.agentIdPromise;
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
      const agentId = await this.ensureAgent(signal);

      // Prior turns are replayed into a fresh thread rather than a thread being
      // held per user. Server-side threads would outlive the request and become
      // conversation content stored outside this app's own retention rules,
      // which its privacy posture does not allow.
      const thread = await this.request<{ id: string }>(
        "/threads",
        {
          method: "POST",
          body: JSON.stringify({
            messages: request.history.map((message) => ({
              role: message.role === "user" ? "user" : "assistant",
              content:
                message.role === "user" ? encloseUntrustedText(message.content) : message.content,
            })),
          }),
        },
        signal,
      );

      await this.request(
        `/threads/${thread.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ role: "user", content: encloseUntrustedText(request.question) }),
        },
        signal,
      );

      let run = await this.request<Run>(
        `/threads/${thread.id}/runs`,
        { method: "POST", body: JSON.stringify({ assistant_id: agentId }) },
        signal,
      );

      let searched = false;

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        run = await this.pollRun(thread.id, run.id, signal);

        if (run.status !== "requires_action") break;

        const calls = run.required_action?.submit_tool_outputs?.tool_calls ?? [];
        const outputs = calls.map((call) => {
          if (call.function.name !== SEARCH_TOOL) {
            return { tool_call_id: call.id, output: JSON.stringify({ error: "Unknown tool." }) };
          }
          searched = true;
          return {
            tool_call_id: call.id,
            output: JSON.stringify(this.search(call.function.arguments, request)),
          };
        });

        run = await this.request<Run>(
          `/threads/${thread.id}/runs/${run.id}/submit_tool_outputs`,
          { method: "POST", body: JSON.stringify({ tool_outputs: outputs }) },
          signal,
        );
      }

      if (run.status !== "completed") {
        throw new AssistantProviderUnavailableError(
          `Agent run ended with status ${run.status}${run.last_error?.code ? ` (${run.last_error.code})` : ""}.`,
        );
      }

      const messages = await this.request<{
        data?: readonly { role: string; content?: readonly { text?: { value?: string } }[] }[];
      }>(`/threads/${thread.id}/messages`, { method: "GET" }, signal);

      const text = messages.data
        ?.find((message) => message.role === "assistant")
        ?.content?.map((part) => part.text?.value ?? "")
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

  private async pollRun(threadId: string, runId: string, signal: AbortSignal): Promise<Run> {
    for (;;) {
      const run = await this.request<Run>(
        `/threads/${threadId}/runs/${runId}`,
        { method: "GET" },
        signal,
      );
      if (run.status !== "queued" && run.status !== "in_progress") return run;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
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
