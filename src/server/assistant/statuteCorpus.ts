/**
 * Verbatim Florida Chapter 61 statutory corpus.
 *
 * This is the assistant's broad-coverage grounding tier. The curated
 * knowledge base (knowledgeBase.ts) stays the preferred source because its
 * entries are written in plain language, but it only covers eleven topics.
 * Questions outside those topics previously retrieved nothing at all, and an
 * assistant that cannot retrieve cannot answer — so it either said "I have
 * no verified material" or, worse, matched an unrelated entry.
 *
 * The text here is enacted statutory language, not a summary. That keeps the
 * "no invented law" guarantee intact while widening coverage: a model
 * grounded on this rephrases the statute, and the built-in adapter quotes it
 * directly with a citation.
 *
 * Regenerate with `npm run sources:statutes`; do not hand edit the JSON.
 */

import corpus from "../../../data/legal/florida/statute-corpus-2025.json";

export interface StatuteChunk {
  readonly id: string;
  readonly section: string;
  readonly sectionTitle: string;
  /** e.g. "(3)(f)"; empty for sections with no numbered subsections. */
  readonly label: string;
  /** e.g. "Fla. Stat. §61.30(3)(f)". */
  readonly citation: string;
  readonly text: string;
  readonly url: string;
}

export interface StatuteCorpusSource {
  readonly section: string;
  readonly title: string;
  readonly url: string;
  readonly sha256: string;
}

export const STATUTE_CHUNKS: readonly StatuteChunk[] = corpus.chunks;

export const STATUTE_CORPUS = {
  corpusId: corpus.corpusId,
  jurisdiction: corpus.jurisdiction,
  statuteCompilation: corpus.statuteCompilation,
  sourceVerifiedAt: corpus.sourceVerifiedAt,
  sources: corpus.sources as readonly StatuteCorpusSource[],
} as const;

const CHUNKS_BY_ID = new Map(STATUTE_CHUNKS.map((chunk) => [chunk.id, chunk]));

export function getStatuteChunk(id: string): StatuteChunk | undefined {
  return CHUNKS_BY_ID.get(id);
}

/** Citation shape used by the rest of the assistant. */
export function statuteChunkCitation(chunk: StatuteChunk) {
  return {
    citation: chunk.citation,
    title: chunk.sectionTitle,
    url: chunk.url,
  };
}
