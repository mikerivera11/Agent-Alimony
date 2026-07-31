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
}

/**
 * Returns the knowledge entries most relevant to a question, best first.
 * An empty array means the assistant has no verified material on the topic
 * and must say so rather than improvising.
 */
export function retrieveKnowledge(question: string, options: RetrievalOptions = {}): readonly RetrievalHit[] {
  const { limit = 3, minimumScore = 2 } = options;

  return KNOWLEDGE_BASE.map((entry) => scoreEntry(entry, question))
    .filter((hit) => hit.score >= minimumScore)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, limit);
}
