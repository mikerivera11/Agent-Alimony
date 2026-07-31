/**
 * Builds the verbatim Florida Chapter 61 statutory corpus the assistant
 * retrieves over.
 *
 * Why this exists: the assistant previously grounded only on eleven
 * hand-written plain-language entries. That corpus could not answer
 * questions it had no entry for, and retrieval cannot retrieve what is not
 * there — questions like "do I include children from another marriage"
 * either returned an unrelated overview or nothing at all.
 *
 * The corpus generated here is *verbatim statutory text* fetched from the
 * official Florida Senate site and chunked by subsection, with a citation
 * and a source hash for every chunk. It is deliberately not summarised or
 * rewritten: a summary is an interpretation, and the whole point of this
 * file is that the assistant's legal substance is traceable to text the
 * Legislature actually enacted.
 *
 * Run with: npm run sources:statutes
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as cheerio from "cheerio";

const COMPILATION = "2025";
const BASE_URL = `https://www.flsenate.gov/Laws/Statutes/${COMPILATION}`;

const OUTPUT_PATH = path.join(
  process.cwd(),
  `data/legal/florida/statute-corpus-${COMPILATION}.json`,
);

/**
 * Chapter 61 sections within this application's subject matter. Sections
 * outside the app's scope are excluded on purpose: retrieving them would
 * invite the assistant to discuss matters the app cannot model and has not
 * tested.
 */
const SECTIONS = [
  "61.046",
  "61.052",
  "61.075",
  "61.077",
  "61.08",
  "61.09",
  "61.13",
  "61.14",
  "61.16",
  "61.29",
  "61.30",
] as const;

/**
 * Subsections longer than this are split into their lettered paragraphs.
 * Whole-subsection chunks like §61.30(2) run past 4,000 characters, which
 * makes them both imprecise to retrieve and wasteful to send as grounding.
 */
const MAX_CHUNK_CHARS = 1_200;

/**
 * The §61.30(6) guidelines schedule is ~12,000 characters of numeric rows.
 * It is excluded from the assistant corpus on purpose: the deterministic
 * calculator already owns the schedule (see
 * child-support-schedule-2025.json), and the assistant is forbidden from
 * stating dollar figures at all, so the table is pure retrieval noise. The
 * statutory sentence introducing the schedule is kept so the assistant can
 * still explain that a schedule exists and governs.
 */
const SCHEDULE_TABLE_SUBSECTIONS = new Set(["61.30(6)"]);

/** Drops the packed numeric rows of a statutory table, keeping all prose. */
function stripScheduleTable(text: string): string {
  // Table cells arrive with no separators ("800.00190211213216218220"), so a
  // run of nine or more digit/comma/period characters is a table row rather
  // than a figure used in a sentence (e.g. "$10,000" is only six).
  return text
    .replace(/\d[\d.,]{8,}/g, "[schedule rows omitted]")
    .replace(/(\[schedule rows omitted\]\s*)+/g, "[schedule rows omitted] ")
    .trim();
}

export interface StatuteChunk {
  /** Stable id, e.g. "61.30-12" or "61.30-3-f". */
  readonly id: string;
  readonly section: string;
  /** Catchline of the parent section. */
  readonly sectionTitle: string;
  /** e.g. "(3)(f)". */
  readonly label: string;
  /** e.g. "Fla. Stat. §61.30(3)(f)". */
  readonly citation: string;
  /** Verbatim statutory text. Never summarised. */
  readonly text: string;
  readonly url: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clean(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strips the trailing em-dash and whitespace Florida catchlines carry. */
function cleanCatchline(value: string): string {
  return clean(value).replace(/[.\u2014\s]+$/u, "");
}

/**
 * Splits a subsection into lettered paragraphs when it is too long to be a
 * useful retrieval unit. Splitting only happens at "(a)"-style boundaries
 * that begin a paragraph, so statutory text is never cut mid-sentence.
 */
function splitSubsection(label: string, text: string): { label: string; text: string }[] {
  if (text.length <= MAX_CHUNK_CHARS) {
    return [{ label, text }];
  }

  const parts: { label: string; text: string }[] = [];
  const pattern = /\(([a-z])\)\s/g;
  const boundaries: { letter: string; index: number }[] = [];

  for (const match of text.matchAll(pattern)) {
    const letter = match[1];
    if (letter && match.index !== undefined) {
      boundaries.push({ letter, index: match.index });
    }
  }

  // Only split when the paragraphs actually run in order (a, b, c ...);
  // otherwise the "(a)" is a cross-reference, not a structural boundary.
  const ordered = boundaries.filter(
    (boundary, index) => boundary.letter === String.fromCharCode(97 + index),
  );

  if (ordered.length < 2) {
    return [{ label, text }];
  }

  const preamble = clean(text.slice(0, ordered[0].index));

  ordered.forEach((boundary, index) => {
    const end = index + 1 < ordered.length ? ordered[index + 1].index : text.length;
    const body = clean(text.slice(boundary.index, end));
    // The preamble carries the sentence the paragraphs complete ("Allowable
    // deductions shall include:"), so each chunk stays readable alone.
    parts.push({
      label: `${label}(${boundary.letter})`,
      text: preamble ? `${preamble} ${body}` : body,
    });
  });

  return parts;
}

async function fetchSection(section: string): Promise<{ html: string; url: string }> {
  const url = `${BASE_URL}/${section}`;
  const response = await fetch(url, {
    headers: { "user-agent": "FloridaSupportGuide/1.0 legal-source-verifier" },
  });

  if (!response.ok) {
    throw new Error(`Fetch of Fla. Stat. §${section} failed with HTTP ${response.status}.`);
  }

  return { html: await response.text(), url };
}

function parseSection(section: string, html: string, url: string): {
  chunks: StatuteChunk[];
  sectionTitle: string;
} {
  const $ = cheerio.load(html);

  const sectionTitle = cleanCatchline($(".Catchline").first().text());
  if (!sectionTitle) {
    throw new Error(`No catchline found for Fla. Stat. §${section}; the page structure changed.`);
  }

  const chunks: StatuteChunk[] = [];
  const subsections = $(".Subsection").toArray();

  // Short sections (e.g. §61.09) are a single unnumbered paragraph with no
  // .Subsection markup at all. That is a valid shape, not a parse failure.
  if (subsections.length === 0) {
    const body = clean($(".SectionBody").first().text()).replace(
      new RegExp(`^${section}\\s*`),
      "",
    );
    const withoutCatchline = body.startsWith(sectionTitle)
      ? clean(body.slice(sectionTitle.length).replace(/^[.\u2014\s]+/u, ""))
      : body;

    if (!withoutCatchline) {
      throw new Error(`No body text found for Fla. Stat. §${section}; the page structure changed.`);
    }

    return {
      sectionTitle,
      chunks: [
        {
          id: section,
          section,
          sectionTitle,
          label: "",
          citation: `Fla. Stat. §${section}`,
          text: withoutCatchline,
          url,
        },
      ],
    };
  }

  for (const element of subsections) {
    const raw = clean($(element).text());
    const labelMatch = /^\((\d+)\)/.exec(raw);
    if (!labelMatch) continue;

    const label = `(${labelMatch[1]})`;
    const text = SCHEDULE_TABLE_SUBSECTIONS.has(`${section}${label}`) ? stripScheduleTable(raw) : raw;

    for (const part of splitSubsection(label, text)) {
      chunks.push({
        id: `${section}${part.label.replace(/[()]/g, (character) => (character === "(" ? "-" : ""))}`,
        section,
        sectionTitle,
        label: part.label,
        citation: `Fla. Stat. §${section}${part.label}`,
        text: part.text,
        url,
      });
    }
  }

  return { chunks, sectionTitle };
}

async function main() {
  const chunks: StatuteChunk[] = [];
  const sources: { section: string; title: string; url: string; sha256: string }[] = [];

  for (const section of SECTIONS) {
    const { html, url } = await fetchSection(section);
    const parsed = parseSection(section, html, url);

    chunks.push(...parsed.chunks);
    sources.push({
      section,
      title: `Fla. Stat. §${section} — ${parsed.sectionTitle}`,
      url,
      sha256: sha256(html),
    });

    console.log(`§${section}: ${parsed.chunks.length} chunks (${parsed.sectionTitle})`);
  }

  const duplicates = chunks
    .map((chunk) => chunk.id)
    .filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate chunk ids generated: ${[...new Set(duplicates)].join(", ")}`);
  }

  const corpus = {
    corpusId: `fl-chapter-61-${COMPILATION}`,
    jurisdiction: "FL",
    statuteCompilation: COMPILATION,
    sourceVerifiedAt: process.env.SOURCE_VERIFIED_AT ?? new Date().toISOString().slice(0, 10),
    sources,
    chunks,
    implementationNotes: [
      "Verbatim statutory text generated from the official Florida Senate site; do not hand edit.",
      "Regenerate with `npm run sources:statutes` when a new compilation is published.",
      "Chunk text is never summarised: the assistant's legal substance must stay traceable to enacted text.",
    ],
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");

  console.log(
    `\nWrote ${chunks.length} chunks from ${sources.length} sections to ` +
      `${path.relative(process.cwd(), OUTPUT_PATH)}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
