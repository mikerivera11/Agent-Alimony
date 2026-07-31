import { describe, expect, it } from "vitest";

import { INTAKE_ASSISTANT_TOPICS, INTAKE_ASSISTANT_TOPIC_IDS } from "@/domain/intake";

import { gatherGrounding, isUngrounded } from "../grounding";
import { scanForCalculatedFigures } from "../guardrails";
import { LocalAssistantAdapter } from "../local-adapter";
import { STATUTE_CHUNKS, STATUTE_CORPUS } from "../statuteCorpus";
import { retrieveStatutes } from "../statuteRetrieval";

const adapter = new LocalAssistantAdapter();

describe("statute corpus integrity", () => {
  it("carries provenance for every source section", () => {
    expect(STATUTE_CORPUS.sources.length).toBeGreaterThan(0);
    for (const source of STATUTE_CORPUS.sources) {
      expect(source.url).toMatch(/^https:\/\/www\.flsenate\.gov\/Laws\/Statutes\/2025\//);
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(STATUTE_CORPUS.sourceVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has unique chunk ids", () => {
    const ids = STATUTE_CHUNKS.map((chunk) => chunk.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every chunk a citation, a section title, and source text", () => {
    for (const chunk of STATUTE_CHUNKS) {
      expect(chunk.citation).toMatch(/^Fla\. Stat\. §61\./);
      expect(chunk.sectionTitle.length).toBeGreaterThan(0);
      expect(chunk.text.trim().length).toBeGreaterThan(0);
      expect(chunk.url).toContain(chunk.section);
    }
  });

  it("excludes the guideline schedule rows, which belong to the calculator", () => {
    // The assistant must never state a dollar figure, so shipping 12KB of
    // schedule numbers as grounding is both useless and a temptation.
    const scheduleChunks = STATUTE_CHUNKS.filter((chunk) => chunk.id.startsWith("61.30-6"));
    expect(scheduleChunks.length).toBeGreaterThan(0);
    for (const chunk of scheduleChunks) {
      expect(chunk.text).toContain("[schedule rows omitted]");
    }
  });

  it("keeps every topic's preferred statute sections present in the corpus", () => {
    const sections = new Set(STATUTE_CHUNKS.map((chunk) => chunk.section));
    for (const topicId of INTAKE_ASSISTANT_TOPIC_IDS) {
      for (const section of INTAKE_ASSISTANT_TOPICS[topicId].statuteSections) {
        expect(sections, `${topicId} prefers §${section}`).toContain(section);
      }
    }
  });
});

describe("retrieveStatutes", () => {
  // Asserted as recall rather than exact rank: every retrieved chunk becomes
  // grounding, so what matters is that the governing section is in the set,
  // not that it happens to sort first. Exact top-1 ranking is where a
  // semantic retriever would beat lexical scoring, and is deliberately not
  // promised here.
  it.each([
    ["what if my spouse is voluntarily unemployed", "61.30"],
    ["is my inheritance marital property", "61.075"],
    ["does cheating affect alimony", "61.08"],
    ["how are overnights counted", "61.30"],
    ["who pays health insurance for the kids", "61.30"],
    ["how long can durational alimony last", "61.08"],
    ["who pays attorney fees", "61.16"],
    ["what is bridge the gap alimony", "61.08"],
    ["what happens to the house", "61.077"],
    ["can child support be modified later", "61.14"],
  ])("retrieves §%s[1] for %j", (question, expectedSection) => {
    const hits = retrieveStatutes(question);
    expect(hits.map((hit) => hit.chunk.section)).toContain(expectedSection);
  });

  it("bridges everyday wording to statutory vocabulary", () => {
    // "imputed" never appears in the question; "voluntarily unemployed" is
    // the statutory phrase people never use.
    const hits = retrieveStatutes("what if my spouse quit their job to lower support");
    expect(hits.map((hit) => hit.chunk.citation)).toContain("Fla. Stat. §61.30(2)(b)");
  });

  it("matches across word forms the statute and a person would each use", () => {
    const hits = retrieveStatutes("can child support be modified later");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("returns nothing for an unrelated question rather than a weak match", () => {
    expect(retrieveStatutes("what is the best pizza in Miami")).toEqual([]);
    expect(retrieveStatutes("how do I renew my passport")).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const ids = () => retrieveStatutes("is my inheritance marital property").map((hit) => hit.chunk.id);
    expect(ids()).toEqual(ids());
  });

  it("lets a preferred section re-rank but never manufacture a match", () => {
    // The boost applies after the relevance filter. A question the corpus
    // does not cover must stay uncovered no matter which section it is asked
    // from, or "I don't have verified material" stops being reachable.
    const hits = retrieveStatutes("what is the best pizza in Miami", {
      preferredSections: ["61.30", "61.08", "61.075"],
    });
    expect(hits).toEqual([]);
  });
});

describe("which children belong in the calculation", () => {
  // The question that motivated this work: asked from the children step,
  // "Do you and your spouse have shared minor children?" prompted "would I
  // also include children from other marriages?" and got a generic overview.
  it.each([
    "would I also include children from other marriages?",
    "do I include my children from a previous relationship",
    "I have a child from another marriage do I list them",
    "should I count children from my first marriage",
    "what about my other kids",
  ])("answers %j from the dedicated entry", async (question) => {
    const answer = await adapter.answer({ question, history: [], topic: "children" });

    expect(answer.outOfScope).toBe(false);
    expect(answer.groundedIn).toContain("child-support-which-children");
  });

  it("explains both the deduction and the subsequent-children limit", async () => {
    const answer = await adapter.answer({
      question: "would I also include children from other marriages?",
      history: [],
      topic: "children",
    });

    const citations = answer.citations.map((citation) => citation.citation);
    expect(citations).toContain("Fla. Stat. §61.30(3)(f)");
    expect(citations).toContain("Fla. Stat. §61.30(12)");
    expect(answer.content).toContain("actually pay");
    expect(answer.content).toMatch(/not\b.*added to the number of children/i);
  });

  it("states no dollar figure", async () => {
    const answer = await adapter.answer({
      question: "would I also include children from other marriages?",
      history: [],
      topic: "children",
    });
    expect(scanForCalculatedFigures(answer.content).containsCurrency).toBe(false);
  });

  it("does not bury the specific answer under the general overview", async () => {
    // The original complaint was a generic response. Once a specific entry
    // existed it ranked first, but the broad child-support overview still
    // followed it and diluted the point, so a clear winner now suppresses
    // the also-rans.
    const answer = await adapter.answer({
      question: "would I also include children from other marriages?",
      history: [],
      topic: "children",
    });

    expect(answer.groundedIn).toEqual(["child-support-which-children"]);
    expect(answer.content).not.toContain("income shares");
  });

  it("only cites sections the answer actually relied on", async () => {
    // Statutory chunks retrieved as model grounding must not leak into the
    // citation list of an answer that never showed them.
    const answer = await adapter.answer({
      question: "would I also include children from other marriages?",
      history: [],
      topic: "children",
    });

    for (const citation of answer.citations) {
      expect(citation.citation).toMatch(/^Fla\. Stat\. §61\.30/);
    }
  });
});

describe("gatherGrounding", () => {
  it("prefers a curated entry and keeps statutes as supporting material", () => {
    const grounding = gatherGrounding("How is child support calculated?", "children");

    expect(grounding.entries.length).toBeGreaterThan(0);
    expect(grounding.statutes.length).toBeLessThanOrEqual(2);
  });

  it("falls back to statutory text when no curated entry covers the question", () => {
    const grounding = gatherGrounding("what is a dependent adult child", undefined);

    expect(grounding.entries).toEqual([]);
    expect(grounding.statutes.length).toBeGreaterThan(0);
  });

  it("reports ungrounded for a question neither tier covers", () => {
    expect(isUngrounded(gatherGrounding("what is the best pizza in Miami", "children"))).toBe(true);
  });
});

describe("LocalAssistantAdapter statutory fallback", () => {
  it("quotes the statute, labelled as statute, when no curated entry exists", async () => {
    const question = "what is a dependent adult child";
    const grounding = gatherGrounding(question, undefined);

    // Guard the premise: if a curated entry ever covers this, the assertion
    // below would silently stop testing the fallback path.
    expect(grounding.entries).toEqual([]);
    expect(grounding.statutes.length).toBeGreaterThan(0);

    const answer = await adapter.answer({ question, history: [] });

    expect(answer.outOfScope).toBe(false);
    expect(answer.content).toContain("statutory text itself");
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.content).toContain(grounding.statutes[0].chunk.citation);
    expect(answer.content).toContain(grounding.statutes[0].chunk.url);
  });

  it("still declines when neither tier has material", async () => {
    const answer = await adapter.answer({ question: "what is the best pizza in Miami", history: [] });

    expect(answer.outOfScope).toBe(true);
    expect(answer.citations).toEqual([]);
  });

  it("never emits a dollar figure from the statutory tier", async () => {
    for (const question of [
      "what is the guidelines schedule amount",
      "how much is the minimum child support need",
      "what percentage applies above the schedule",
    ]) {
      const answer = await adapter.answer({ question, history: [] });
      expect(scanForCalculatedFigures(answer.content).containsCurrency, question).toBe(false);
    }
  });
});
