/**
 * Adapter boundary for the Florida family-law information assistant.
 *
 * Mirrors `src/server/extraction/` deliberately: the app works fully
 * locally with no AI provider configured, and a real provider is an
 * explicit opt-in rather than a default. Critically, the *substance* of
 * every answer comes from the curated knowledge base either way — a model,
 * when configured, only rephrases retrieved passages. No adapter is ever
 * permitted to be the source of legal content or of a dollar figure.
 */

import type { StatutoryCitation } from "@/domain/rules/types";

import type { EscalationSignal } from "./guardrails";

export interface AssistantMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface AssistantRequest {
  /** The person's current question. Untrusted data. */
  readonly question: string;
  /** Prior turns, oldest first. Untrusted data. */
  readonly history: readonly AssistantMessage[];
}

export interface AssistantAnswer {
  readonly content: string;
  readonly citations: readonly StatutoryCitation[];
  readonly escalations: readonly EscalationSignal[];
  /** Knowledge base entry ids that grounded this answer. */
  readonly groundedIn: readonly string[];
  /** Adapter label, always surfaced so users know what produced the text. */
  readonly source: string;
  /** True when no verified material covered the question. */
  readonly outOfScope: boolean;
  /** Set when a guardrail rewrote or replaced adapter output. */
  readonly guardrailNote?: string;
}

export interface AssistantAdapter {
  readonly name: string;
  readonly label: string;
  answer(request: AssistantRequest): Promise<AssistantAnswer>;
}

/** Thrown when a non-local adapter cannot run. Never falls back silently. */
export class AssistantProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssistantProviderUnavailableError";
  }
}

// Re-exported so server code keeps a single import site, while the client can
// import the same numbers without reaching into `src/server/`.
export { MAX_CONVERSATION_LENGTH, MAX_HISTORY_TURNS, MAX_QUESTION_LENGTH } from "@/lib/assistantLimits";
