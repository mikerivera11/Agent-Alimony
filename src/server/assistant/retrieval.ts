/**
 * Deterministic retrieval over the curated Florida knowledge base.
 *
 * Scoring is a transparent keyword/phrase match rather than an embedding
 * model. That is a deliberate trade-off: it is fully testable, needs no
 * network call, runs identically in local development and in production,
 * and cannot silently drift. The knowledge base is small and hand-curated,
 * so lexical matching is sufficient.
 */

import { KNOWLEDGE_BASE, type KnowledgeEntry } from "./knowledgeBase";
import { INTAKE_ASSISTANT_TOPICS, type IntakeStepId } from "@/domain/intake";

export interface RetrievalHit {
  readonly entry: KnowledgeEntry;
  readonly score: number;
  /** Keywords that caused the match, for debugging and transparency. */
  readonly matchedKeywords: readonly string[];
}

/** Words too common to carry topical signal. */
const STOP_WORDS = new Set([
  "a", "about", "am", "an", "and", "any", "are", "as", "at", "be", "been", "but", "by", "can", "could", "did",
  "do", "does", "for", "from", "get", "had", "has", "have", "how", "i", "if", "in", "is", "it", "its",
  "me", "my", "of", "on", "or", "our", "so", "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "to", "up", "us", "was", "we", "were", "what", "when", "where", "which", "who", "why", "will",
  "with", "would", "you", "your",
]);

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}%()/\s-]/gu, " ");
}

function tokenise(text: string): readonly string[] {
  return normalise(text)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Scores one entry against a question. Multi-word keywords matched as a
 * phrase score highest, because "lump sum" or "time sharing" are far more
 * diagnostic than either word alone.
 */
function scoreEntry(entry: KnowledgeEntry, question: string): RetrievalHit {
  const normalisedQuestion = normalise(question);
  const questionTokens = new Set(tokenise(question));
  const matchedKeywords: string[] = [];
  let score = 0;

  for (const keyword of entry.keywords) {
    const normalisedKeyword = normalise(keyword).trim();
    const isPhrase = normalisedKeyword.includes(" ");

    if (isPhrase) {
      if (normalisedQuestion.includes(normalisedKeyword)) {
        score += 5;
        matchedKeywords.push(keyword);
      }
      continue;
    }

    if (questionTokens.has(normalisedKeyword)) {
      score += 2;
      matchedKeywords.push(keyword);
    }
  }

  // A direct hit on the entry's own title is a strong signal.
  const titleTokens = tokenise(entry.title);
  const titleOverlap = titleTokens.filter((token) => questionTokens.has(token)).length;
  score += titleOverlap;

  return { entry, score, matchedKeywords };
}

export interface RetrievalOptions {
  /** Maximum entries returned. Defaults to 3. */
  readonly limit?: number;
  /** Minimum score required to be considered relevant. Defaults to 2. */
  readonly minimumScore?: number;
  /**
   * Entry ids known to cover the intake section the question was asked from.
   *
   * These only *re-rank* entries the question already matched on its own. They
   * deliberately cannot lift an entry from zero, because the topic is supplied
   * by the app rather than typed by the person: letting it create a match would
   * mean a question the knowledge base does not actually cover comes back
   * confidently answered with whatever the current section happens to be about.
   * "I don't have verified material on that" has to stay reachable.
   */
  readonly preferredEntryIds?: readonly string[];
}

/** Enough to re-rank near-ties, never enough to invent relevance. */
const PREFERRED_ENTRY_BOOST = 1;

/**
 * Entries scoring below this fraction of the best hit are dropped.
 *
 * Without it, a question with one obviously-correct answer still returns the
 * broad overview entries that share a word or two with it, and those get
 * appended underneath. That is what made "would I also include children from
 * other marriages?" read as a generic answer even once a specific entry
 * existed: the specific entry was first, but the general child-support
 * overview followed it and buried the point.
 */
const RELEVANCE_GAP_RATIO = 0.4;

/**
 * Retrieval options for a question asked from a specific intake section.
 * Kept here so every adapter grounds the same way — an adapter that retrieved
 * differently would be a second, untested source of legal grounding.
 */
export function topicRetrievalOptions(topic: IntakeStepId | undefined): RetrievalOptions {
  if (!topic) return {};
  return { preferredEntryIds: INTAKE_ASSISTANT_TOPICS[topic].knowledgeEntryIds };
}

/**
 * Returns the knowledge entries most relevant to a question, best first.
 * An empty array means the assistant has no verified material on the topic
 * and must say so rather than improvising.
 */
export function retrieveKnowledge(question: string, options: RetrievalOptions = {}): readonly RetrievalHit[] {
  const { limit = 3, minimumScore = 2, preferredEntryIds = [] } = options;
  const preferred = new Set(preferredEntryIds);

  const ranked = KNOWLEDGE_BASE.map((entry) => scoreEntry(entry, question))
    // The boost is applied after this filter, so a preferred entry still has to
    // earn its place on the question's own merits before being promoted.
    .filter((hit) => hit.score >= minimumScore)
    .map((hit) => (preferred.has(hit.entry.id) ? { ...hit, score: hit.score + PREFERRED_ENTRY_BOOST } : hit))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));

  if (ranked.length === 0) return ranked;

  const threshold = ranked[0].score * RELEVANCE_GAP_RATIO;
  return ranked.filter((hit) => hit.score >= threshold).slice(0, limit);
}
