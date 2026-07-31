/**
 * The assistant's single grounding entry point.
 *
 * Both adapters call this so there is exactly one answer to "where could this
 * sentence have come from". An adapter that retrieved differently would be a
 * second, separately-behaving source of legal grounding, which is precisely
 * the thing this module exists to prevent.
 *
 * Two tiers, in priority order:
 *
 * 1. **Curated entries** — plain-language, hand-checked, written for someone
 *    with no legal background. Preferred whenever one matches.
 * 2. **Verbatim statutory text** — the whole of the app's slice of Chapter 61.
 *    Eleven curated entries cannot cover a chapter, and before this tier
 *    existed a question outside them retrieved either nothing or, worse, a
 *    confident-looking answer from an unrelated entry.
 *
 * Both tiers are gated on the question's own relevance. Section context only
 * ever re-ranks what already matched, so "I don't have verified material on
 * that" stays reachable — that sentence is a feature, not a failure.
 */

import { INTAKE_ASSISTANT_TOPICS, type IntakeStepId } from "@/domain/intake";

import { retrieveKnowledge, topicRetrievalOptions, type RetrievalHit } from "./retrieval";
import { retrieveStatutes, type StatuteHit } from "./statuteRetrieval";

export interface Grounding {
  readonly entries: readonly RetrievalHit[];
  readonly statutes: readonly StatuteHit[];
}

/** Statute retrieval options for a question asked from an intake section. */
export function topicStatuteOptions(topic: IntakeStepId | undefined) {
  if (!topic) return {};
  return { preferredSections: INTAKE_ASSISTANT_TOPICS[topic].statuteSections };
}

/**
 * When a curated entry already answers the question, statutory chunks are
 * still retrieved but trimmed: they are supporting text, and a long tail of
 * formal statutory prose after a clear plain-language answer makes the answer
 * harder to read, not better sourced.
 */
const SUPPORTING_STATUTE_LIMIT = 2;

export function gatherGrounding(question: string, topic: IntakeStepId | undefined): Grounding {
  const entries = retrieveKnowledge(question, topicRetrievalOptions(topic));

  const statutes = retrieveStatutes(question, {
    ...topicStatuteOptions(topic),
    limit: entries.length > 0 ? SUPPORTING_STATUTE_LIMIT : 4,
  });

  return { entries, statutes };
}

/** True when neither tier found anything the assistant may rely on. */
export function isUngrounded(grounding: Grounding): boolean {
  return grounding.entries.length === 0 && grounding.statutes.length === 0;
}
