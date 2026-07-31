/**
 * Deterministic retrieval over the verbatim statutory corpus.
 *
 * This complements the curated knowledge base rather than replacing it. The
 * curated entries are plain-language and hand-checked, so they answer first;
 * this tier exists because eleven entries cannot cover Chapter 61, and an
 * unanswerable question previously produced either "no verified material" or
 * a confident match on an unrelated entry.
 *
 * Scoring is BM25 — still fully deterministic, still no network call, still
 * identical in development and production, but unlike raw keyword counting it
 * discounts terms that appear in most chunks ("court", "support", "child")
 * and normalises for chunk length. With 172 chunks of formal statutory prose
 * that difference decides whether the right subsection surfaces at all.
 */

import {
  STATUTE_CHUNKS,
  type StatuteChunk,
} from "./statuteCorpus";

export interface StatuteHit {
  readonly chunk: StatuteChunk;
  readonly score: number;
  /** Query terms that contributed, for transparency and debugging. */
  readonly matchedTerms: readonly string[];
}

/**
 * Bridges everyday wording to statutory vocabulary. People do not say
 * "time-sharing" or "net income"; the statute never says "overnights" or
 * "take-home pay". Without this, correct questions retrieve nothing.
 *
 * This is strictly a *retrieval* aid: it can only change which enacted text
 * is surfaced, never what that text says. A wrong expansion surfaces a less
 * relevant subsection, which the reader sees quoted with its citation.
 */
const VOCABULARY_BRIDGE: Readonly<Record<string, readonly string[]>> = {
  custody: ["time-sharing", "parental", "responsibility"],
  visitation: ["time-sharing"],
  overnight: ["time-sharing", "overnights"],
  overnights: ["time-sharing"],
  timesharing: ["time-sharing"],
  daycare: ["child", "care"],
  babysitter: ["child", "care"],
  childcare: ["child", "care"],
  "take-home": ["net", "income"],
  takehome: ["net", "income"],
  paycheck: ["net", "income", "salary", "wages"],
  paystub: ["salary", "wages"],
  stepchild: ["child", "dependent"],
  stepchildren: ["child", "dependent"],
  stepparent: ["child", "dependent"],
  college: ["high", "school", "dependent", "18"],
  school: ["high", "school", "dependent"],
  quit: ["voluntarily", "unemployed", "underemployed", "imputed"],
  quitting: ["voluntarily", "unemployed", "underemployed", "imputed"],
  fired: ["voluntarily", "unemployed", "underemployed", "imputed"],
  unemployed: ["voluntarily", "unemployed", "underemployed", "imputed"],
  hiding: ["imputed", "voluntarily", "underemployed"],
  hides: ["imputed", "voluntarily", "underemployed"],
  hidden: ["imputed", "voluntarily", "underemployed"],
  hide: ["imputed", "voluntarily", "underemployed"],
  modify: ["modification", "modified"],
  change: ["modification", "substantial"],
  changed: ["modification", "substantial"],
  lower: ["modification", "reduce"],
  raise: ["modification", "increase"],
  house: ["marital", "home", "real", "property"],
  home: ["marital", "home"],
  mortgage: ["marital", "home", "liabilities"],
  "401k": ["retirement", "plans", "pension"],
  ira: ["retirement", "plans", "pension"],
  pension: ["retirement", "plans"],
  taxes: ["income", "tax", "deductions"],
  tax: ["income", "tax", "deductions"],
  insurance: ["health", "insurance", "coverage"],
  premium: ["health", "insurance"],
  premiums: ["health", "insurance"],
  raises: ["modification"],
  prenup: ["agreement"],
  prenuptial: ["agreement"],
  cheating: ["adultery"],
  affair: ["adultery"],
  divorce: ["dissolution", "marriage"],
  divorced: ["dissolution", "marriage"],
  separated: ["dissolution", "marriage"],
  kids: ["child", "children"],
  kid: ["child", "children"],
  ex: ["former", "spouse"],
  disabled: ["disability", "incapacity"],
  disability: ["disability", "incapacity"],
  "special-needs": ["mental", "physical", "incapacity", "dependent"],
  inheritance: ["nonmarital", "devise", "bequest", "descent"],
  inherited: ["nonmarital", "devise", "bequest", "descent"],
  gift: ["nonmarital", "gifts"],
  business: ["self-employment", "business", "partnership", "corporation"],
  bonus: ["bonuses"],
  bonuses: ["bonuses"],
  overtime: ["overtime"],
  military: ["military", "reserve"],
  relocate: ["relocation"],
  relocating: ["relocation"],
  "college-fund": ["dependent"],
};

/** Words too common to carry topical signal. */
const STOP_WORDS = new Set([
  "a", "about", "also", "am", "an", "and", "any", "are", "as", "at", "be", "been", "both", "but", "by",
  "can", "could", "did", "do", "does", "for", "from", "get", "go", "had", "has", "have", "he", "her",
  "him", "his", "how", "i", "if", "in", "include", "is", "it", "its", "just", "me", "much", "my", "need",
  "of", "on", "or", "our", "out", "she", "should", "so", "some", "than", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "to", "up", "us", "was", "we", "were", "what", "when",
  "where", "which", "who", "why", "will", "with", "would", "you", "your",
]);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ");
}

function tokenise(text: string): string[] {
  return normalise(text)
    .split(/\s+/)
    .map((token) => token.replace(/^['-]+|['-]+$/g, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Deliberately crude stemmer: light suffix stripping, then truncation to a
 * five-character prefix.
 *
 * A real stemmer would be another dependency and another source of drift.
 * Truncation is blunt but it is what makes statutory and everyday wording
 * meet: "modified"/"modification"/"modify" all become "modif", and
 * "children"/"child" both become "child". Without it those pairs never match
 * and questions like "can child support be modified later" retrieve nothing.
 *
 * Over-merging is acceptable here because IDF weighting already discounts
 * terms that end up common, and the corpus vocabulary is narrow.
 */
function stem(token: string): string {
  let value = token;

  if (value.length > 4) {
    for (const suffix of ["ies", "ing", "ed", "es", "s"]) {
      if (value.endsWith(suffix) && value.length - suffix.length >= 3) {
        value = suffix === "ies" ? `${value.slice(0, -3)}y` : value.slice(0, -suffix.length);
        break;
      }
    }
  }

  return value.length > 5 ? value.slice(0, 5) : value;
}

function expandQuery(question: string): string[] {
  const expanded = new Set<string>();

  for (const token of tokenise(question)) {
    expanded.add(stem(token));
    for (const alias of VOCABULARY_BRIDGE[token] ?? []) {
      // Aliases go through the same tokeniser so multi-word and hyphenated
      // expansions ("time-sharing") index the same way the corpus does.
      for (const aliasToken of tokenise(alias)) {
        expanded.add(stem(aliasToken));
      }
    }
  }

  return [...expanded];
}

/**
 * Adjacent word pairs from the question, stemmed. "other children" and
 * "health insurance" are far more diagnostic than either word alone, and in
 * a corpus where "child" and "support" appear nearly everywhere, phrase
 * evidence is often the only thing that separates the governing subsection
 * from thirty others.
 */
function queryBigrams(question: string): string[] {
  const tokens = tokenise(question).map(stem);
  const bigrams: string[] = [];
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    bigrams.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return bigrams;
}

// --- BM25 index, built once at module load --------------------------------

const K1 = 1.2;
const B = 0.75;

interface IndexedChunk {
  readonly chunk: StatuteChunk;
  readonly termFrequency: ReadonlyMap<string, number>;
  readonly bigrams: ReadonlySet<string>;
  readonly length: number;
}

function buildIndex(): {
  documents: IndexedChunk[];
  documentFrequency: Map<string, number>;
  averageLength: number;
} {
  const documents: IndexedChunk[] = [];
  const documentFrequency = new Map<string, number>();

  for (const chunk of STATUTE_CHUNKS) {
    // The catchline is indexed with the body so that a question naming the
    // topic ("alimony", "time-sharing") reaches every subsection of the
    // section that governs it, not only the ones that repeat the word.
    const tokens = tokenise(`${chunk.sectionTitle} ${chunk.text}`).map(stem);
    const termFrequency = new Map<string, number>();

    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }
    for (const term of termFrequency.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }

    const bigrams = new Set<string>();
    for (let index = 0; index + 1 < tokens.length; index += 1) {
      bigrams.add(`${tokens[index]} ${tokens[index + 1]}`);
    }

    documents.push({ chunk, termFrequency, bigrams, length: tokens.length });
  }

  const averageLength =
    documents.reduce((total, document) => total + document.length, 0) / Math.max(documents.length, 1);

  return { documents, documentFrequency, averageLength };
}

const INDEX = buildIndex();

function inverseDocumentFrequency(term: string): number {
  const count = INDEX.documentFrequency.get(term) ?? 0;
  if (count === 0) return 0;
  const total = INDEX.documents.length;
  return Math.log(1 + (total - count + 0.5) / (count + 0.5));
}

export interface StatuteRetrievalOptions {
  /** Maximum chunks returned. Defaults to 4. */
  readonly limit?: number;
  /**
   * Minimum BM25 score required. Defaults to 4.
   *
   * This threshold is the reason "I don't have verified material on that"
   * stays reachable. It must not be lowered to make the assistant look more
   * capable: a low-scoring statutory chunk is a chunk that does not answer
   * the question, and quoting it with a citation would look authoritative
   * while being irrelevant.
   */
  readonly minimumScore?: number;
  /** Sections known to govern the section of the app the question came from. */
  readonly preferredSections?: readonly string[];
}

/** Enough to break near-ties, never enough to invent relevance. */
const PREFERRED_SECTION_BOOST = 1.15;

/**
 * Chunks scoring below this fraction of the best hit are dropped.
 *
 * BM25 will always rank *something* above the threshold once a question is
 * broadly on-topic, so without a relative gap the reader gets the governing
 * subsection followed by two or three loosely-related ones. Quoting statute
 * at somebody is expensive attention-wise; padding it with near-misses makes
 * the answer worse, not better sourced.
 */
const RELEVANCE_GAP_RATIO = 0.55;

/**
 * Weight for an exact adjacent-word-pair match. Set well above a typical
 * single-term contribution because in this corpus a matching phrase is much
 * stronger evidence than two separately common words.
 */
const BIGRAM_BOOST = 3;

export function retrieveStatutes(
  question: string,
  options: StatuteRetrievalOptions = {},
): readonly StatuteHit[] {
  const { limit = 4, minimumScore = 4, preferredSections = [] } = options;
  const terms = expandQuery(question);
  if (terms.length === 0) return [];

  const bigrams = queryBigrams(question);
  const preferred = new Set(preferredSections);

  const hits: StatuteHit[] = INDEX.documents.map((document) => {
    let score = 0;
    const matchedTerms: string[] = [];

    for (const term of terms) {
      const frequency = document.termFrequency.get(term);
      if (!frequency) continue;

      const idf = inverseDocumentFrequency(term);
      const numerator = frequency * (K1 + 1);
      const denominator =
        frequency + K1 * (1 - B + (B * document.length) / INDEX.averageLength);

      score += idf * (numerator / denominator);
      matchedTerms.push(term);
    }

    for (const bigram of bigrams) {
      if (document.bigrams.has(bigram)) {
        score += BIGRAM_BOOST;
        matchedTerms.push(bigram);
      }
    }

    return { chunk: document.chunk, score, matchedTerms };
  });

  const ranked = hits
    // Filtered before the preference boost, so a preferred section still has
    // to earn relevance from the question itself.
    .filter((hit) => hit.score >= minimumScore)
    .map((hit) =>
      preferred.has(hit.chunk.section) ? { ...hit, score: hit.score * PREFERRED_SECTION_BOOST } : hit,
    )
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));

  if (ranked.length === 0) return ranked;

  const threshold = ranked[0].score * RELEVANCE_GAP_RATIO;
  return ranked.filter((hit) => hit.score >= threshold).slice(0, limit);
}
