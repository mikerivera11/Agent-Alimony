/**
 * Azure AI Foundry assistant adapter (Azure OpenAI GPT).
 *
 * Calls the Azure OpenAI chat-completions API exposed by a Foundry resource at
 * `https://<resource>.services.ai.azure.com/openai`. Implemented with `fetch`
 * and `@azure/identity` rather than a provider SDK: the wire format is stable
 * and documented, `@azure/identity` is already a dependency for Blob and Key
 * Vault, and this avoids taking a hard dependency on an SDK for a path that
 * cannot be exercised without a live Azure subscription.
 *
 * NOTE: this transport has not been run against a live Foundry resource. That
 * is survivable by construction — every failure path below falls back to the
 * deterministic local adapter, so a wrong route or api-version degrades to the
 * built-in statute reference instead of breaking the assistant.
 *
 * The model NEVER supplies legal substance. It receives only passages
 * retrieved from the curated knowledge base and rephrases them. Its output
 * is then re-checked: any dollar figure, or a failure of any kind, falls
 * back to the deterministic local adapter rather than degrading silently.
 */

import { DefaultAzureCredential, type TokenCredential } from "@azure/identity";

import { getServerEnv } from "@/lib/env";

import {
  AssistantProviderUnavailableError,
  type AssistantAdapter,
  type AssistantAnswer,
  type AssistantRequest,
} from "./adapter";
import { detectEscalationSignals, encloseUntrustedText, scanForCalculatedFigures, scanForPromptInjection } from "./guardrails";
import { LocalAssistantAdapter } from "./local-adapter";
import { gatherGrounding, isUngrounded } from "./grounding";
import { statuteChunkCitation } from "./statuteCorpus";
import { ASSISTANT_SYSTEM_PROMPT, buildGroundingBlock } from "./systemPrompt";

/** Entra scope for the Azure OpenAI data plane on an AI Services resource. */
const FOUNDRY_TOKEN_SCOPE = "https://cognitiveservices.azure.com/.default";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Sampling parameters are deliberately omitted. Current GPT reasoning models
 * reject a non-default `temperature`, and this adapter only ever rephrases
 * passages it was handed — there is nothing to gain from sampling knobs and a
 * rejected request costs us the answer.
 */
const MAX_OUTPUT_TOKENS = 1024;

interface ChatCompletionResponse {
  readonly choices?: readonly {
    readonly message?: { readonly content?: string };
    readonly finish_reason?: string;
  }[];
}

export class FoundryAssistantAdapter implements AssistantAdapter {
  readonly name = "foundry";
  readonly label = "Azure AI Foundry (Azure OpenAI GPT), grounded in Florida statutes";

  private readonly fallback = new LocalAssistantAdapter();
  private credential: TokenCredential | undefined;

  async answer(request: AssistantRequest): Promise<AssistantAnswer> {
    const escalations = detectEscalationSignals(request.question);

    // Refuse injection attempts before spending a model call.
    if (scanForPromptInjection(request.question).detected) {
      return this.fallback.answer(request);
    }

    const grounding = gatherGrounding(request.question, request.topic);

    // No verified grounding means nothing for the model to rephrase. Saying
    // "I don't know" is the correct answer and needs no model call.
    if (isUngrounded(grounding)) {
      return this.fallback.answer(request);
    }

    let text: string;
    try {
      text = await this.callModel(request, buildGroundingBlock(grounding));
    } catch {
      // Never surface provider errors or degrade into invented content.
      const fallbackAnswer = await this.fallback.answer(request);
      return {
        ...fallbackAnswer,
        guardrailNote:
          "The AI assistant was unavailable, so this answer came from the app's built-in statute reference instead.",
      };
    }

    // Guardrail: the model must not produce figures. Any currency in the
    // output means it calculated or invented something.
    const figureScan = scanForCalculatedFigures(text);
    if (figureScan.containsCurrency) {
      const fallbackAnswer = await this.fallback.answer(request);
      return {
        ...fallbackAnswer,
        guardrailNote:
          "The AI response was replaced because it contained a dollar figure. Every figure in this app comes " +
          "from its own deterministic calculators.",
      };
    }

    return {
      content: text.trim(),
      citations: [
        ...grounding.entries.flatMap((hit) => hit.entry.citations),
        ...grounding.statutes.map((hit) => statuteChunkCitation(hit.chunk)),
      ],
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
    this.credential ??= new DefaultAzureCredential();
    return this.credential;
  }

  private async authorizationHeader(): Promise<Record<string, string>> {
    const env = getServerEnv();

    // API key is supported but managed identity is preferred in Azure.
    if (env.AZURE_FOUNDRY_API_KEY) {
      return { "api-key": env.AZURE_FOUNDRY_API_KEY };
    }

    const token = await this.getCredential().getToken(FOUNDRY_TOKEN_SCOPE);
    if (!token) {
      throw new AssistantProviderUnavailableError(
        "Could not acquire an Entra ID token for Azure AI Foundry. Ensure the app's identity holds the " +
          "Cognitive Services OpenAI User role on the Foundry resource.",
      );
    }
    return { Authorization: `Bearer ${token.token}` };
  }

  private async callModel(request: AssistantRequest, groundingBlock: string): Promise<string> {
    const env = getServerEnv();

    if (!env.AZURE_FOUNDRY_ENDPOINT || !env.AZURE_FOUNDRY_DEPLOYMENT) {
      throw new AssistantProviderUnavailableError(
        "ASSISTANT_PROVIDER=foundry requires AZURE_FOUNDRY_ENDPOINT and AZURE_FOUNDRY_DEPLOYMENT.",
      );
    }

    const messages = [
      { role: "system" as const, content: ASSISTANT_SYSTEM_PROMPT },
      ...request.history.map((message) => ({
        role: message.role,
        content: message.role === "user" ? encloseUntrustedText(message.content) : message.content,
      })),
      { role: "user" as const, content: `${groundingBlock}\n\n${encloseUntrustedText(request.question)}` },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url =
        `${env.AZURE_FOUNDRY_ENDPOINT.replace(/\/$/, "")}/openai/deployments/` +
        `${encodeURIComponent(env.AZURE_FOUNDRY_DEPLOYMENT)}/chat/completions` +
        `?api-version=${encodeURIComponent(env.AZURE_FOUNDRY_API_VERSION)}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(await this.authorizationHeader()),
        },
        body: JSON.stringify({
          messages,
          max_completion_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Deliberately does not include the response body: it can echo the
        // user's question, which may contain sensitive financial details.
        throw new AssistantProviderUnavailableError(
          `Azure AI Foundry returned status ${response.status}.`,
        );
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const text = (payload.choices?.[0]?.message?.content ?? "").trim();

      if (!text) {
        throw new AssistantProviderUnavailableError("Azure AI Foundry returned an empty response.");
      }
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}
