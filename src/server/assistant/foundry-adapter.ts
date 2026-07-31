/**
 * Azure AI Foundry assistant adapter (Claude Opus 5).
 *
 * Calls the Anthropic Messages API exposed by a Foundry resource at
 * `https://<resource>.services.ai.azure.com/anthropic`. Implemented with
 * `fetch` and `@azure/identity` rather than a provider SDK: the Messages
 * wire format and the `anthropic-version` header are stable and documented,
 * `@azure/identity` is already a dependency for Blob and Key Vault, and this
 * avoids taking a hard dependency on a 0.x SDK for a path that cannot be
 * exercised without a live Azure subscription.
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
import { retrieveKnowledge } from "./retrieval";
import { ASSISTANT_SYSTEM_PROMPT, buildGroundingBlock } from "./systemPrompt";

/** Entra scope for Foundry data-plane calls. Note: ai.azure.com, not cognitiveservices. */
const FOUNDRY_TOKEN_SCOPE = "https://ai.azure.com/.default";
const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Claude Opus 5 on Foundry rejects `temperature` and `top_k`, and requires
 * `top_p` to be exactly 0.99 when supplied.
 */
const TOP_P = 0.99;
const MAX_OUTPUT_TOKENS = 1024;

interface AnthropicContentBlock {
  readonly type: string;
  readonly text?: string;
}

interface AnthropicMessagesResponse {
  readonly content?: readonly AnthropicContentBlock[];
  readonly stop_reason?: string;
}

export class FoundryAssistantAdapter implements AssistantAdapter {
  readonly name = "foundry";
  readonly label = "Azure AI Foundry (Claude Opus 5), grounded in Florida statutes";

  private readonly fallback = new LocalAssistantAdapter();
  private credential: TokenCredential | undefined;

  async answer(request: AssistantRequest): Promise<AssistantAnswer> {
    const escalations = detectEscalationSignals(request.question);

    // Refuse injection attempts before spending a model call.
    if (scanForPromptInjection(request.question).detected) {
      return this.fallback.answer(request);
    }

    const hits = retrieveKnowledge(request.question);

    // No verified grounding means nothing for the model to rephrase. Saying
    // "I don't know" is the correct answer and needs no model call.
    if (hits.length === 0) {
      return this.fallback.answer(request);
    }

    let text: string;
    try {
      text = await this.callModel(request, buildGroundingBlock(hits));
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
      citations: hits.flatMap((hit) => hit.entry.citations),
      escalations,
      groundedIn: hits.map((hit) => hit.entry.id),
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
      return { "x-api-key": env.AZURE_FOUNDRY_API_KEY };
    }

    const token = await this.getCredential().getToken(FOUNDRY_TOKEN_SCOPE);
    if (!token) {
      throw new AssistantProviderUnavailableError(
        "Could not acquire an Entra ID token for Azure AI Foundry. Ensure the app's identity holds the " +
          "Cognitive Services User role on the Foundry resource.",
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
      ...request.history.map((message) => ({
        role: message.role,
        content: message.role === "user" ? encloseUntrustedText(message.content) : message.content,
      })),
      { role: "user" as const, content: `${groundingBlock}\n\n${encloseUntrustedText(request.question)}` },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.AZURE_FOUNDRY_ENDPOINT.replace(/\/$/, "")}/anthropic/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": ANTHROPIC_VERSION,
          ...(await this.authorizationHeader()),
        },
        body: JSON.stringify({
          model: env.AZURE_FOUNDRY_DEPLOYMENT,
          max_tokens: MAX_OUTPUT_TOKENS,
          top_p: TOP_P,
          system: ASSISTANT_SYSTEM_PROMPT,
          messages,
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

      const payload = (await response.json()) as AnthropicMessagesResponse;
      const text = (payload.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("")
        .trim();

      if (!text) {
        throw new AssistantProviderUnavailableError("Azure AI Foundry returned an empty response.");
      }
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}
