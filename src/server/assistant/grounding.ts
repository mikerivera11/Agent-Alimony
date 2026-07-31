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
import type { StatutoryCitation } from "@/domain/rules/types";

import { retrieveKnowledge, topicRetrievalOptions, type RetrievalHit } from "./retrieval";
import { statuteChunkCitation } from "./statuteCorpus";
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

/**
 * The citations an answer built on this grounding may show.
 *
 * A citation is a promise that the cited text supports the answer, so this is
 * narrower than "everything retrieval touched". When curated entries answered,
 * only their own citations are listed: statutory chunks retrieved alongside
 * them are grounding a model read, not authority the answer relied on. Citing
 * them sent readers to, for example, s. 61.14 (modification) for a question
 * about which children appear on the worksheet.
 *
 * Statute chunks are cited only when they are the sole grounding, because then
 * they are exactly what the answer was built from.
 *
 * This lives here, rather than in each adapter, because it previously did not:
 * the local adapter was fixed and the Foundry adapter was not, and the two
 * silently disagreed about what the user was told supported their answer.
 */
export function groundingCitations(grounding: Grounding): readonly StatutoryCitation[] {
  const groups =
    grounding.entries.length > 0
      ? grounding.entries.map((hit) => hit.entry.citations)
      : [grounding.statutes.map((hit) => statuteChunkCitation(hit.chunk))];

  const seen = new Set<string>();
  const merged: StatutoryCitation[] = [];
  for (const citation of groups.flat()) {
    if (seen.has(citation.citation)) continue;
    seen.add(citation.citation);
    merged.push(citation);
  }
  return merged;
}
