import { describe, expect, it } from "vitest";

import { INTAKE_ASSISTANT_TOPICS, INTAKE_ASSISTANT_TOPIC_IDS, INTAKE_STEPS } from "@/domain/intake";
import { KNOWLEDGE_BASE } from "../knowledgeBase";
import { retrieveKnowledge, topicRetrievalOptions } from "../retrieval";

describe("intake assistant topic map", () => {
  it("covers every intake step, so no section is left without inline help", () => {
    expect([...INTAKE_ASSISTANT_TOPIC_IDS].sort()).toEqual(Object.keys(INTAKE_STEPS).sort());
  });

  it("only points at knowledge base entries that actually exist", () => {
    const knownIds = new Set(KNOWLEDGE_BASE.map((entry) => entry.id));
    for (const [stepId, topic] of Object.entries(INTAKE_ASSISTANT_TOPICS)) {
      for (const entryId of topic.knowledgeEntryIds) {
        expect(knownIds, `${stepId} references unknown entry "${entryId}"`).toContain(entryId);
      }
    }
  });

  it("gives every section at least one starter question", () => {
    for (const [stepId, topic] of Object.entries(INTAKE_ASSISTANT_TOPICS)) {
      expect(topic.suggestedQuestions.length, `${stepId} has no suggested questions`).toBeGreaterThan(0);
    }
  });

  it("answers every suggested question with grounded material rather than a shrug", () => {
    for (const [stepId, topic] of Object.entries(INTAKE_ASSISTANT_TOPICS)) {
      const options = topicRetrievalOptions(stepId as keyof typeof INTAKE_ASSISTANT_TOPICS);
      for (const question of topic.suggestedQuestions) {
        const hits = retrieveKnowledge(question, options);
        expect(hits.length, `"${question}" (${stepId}) retrieved nothing`).toBeGreaterThan(0);
      }
    }
  });
});

describe("topic-biased retrieval", () => {
  it("never manufactures a match: a question the knowledge base does not cover stays uncovered", () => {
    // The topic is supplied by the app, not typed by the person. If it could
    // lift an entry from zero, every unanswerable question asked from the
    // alimony section would come back confidently answered about alimony.
    const hits = retrieveKnowledge(
      "what is the best pizza topping in Naples",
      topicRetrievalOptions("alimonyFactors"),
    );
    expect(hits).toHaveLength(0);
  });

  it("leaves a genuinely vague question unanswered rather than guessing from the section", () => {
    expect(retrieveKnowledge("what counts here?", topicRetrievalOptions("assetsDebts"))).toHaveLength(0);
  });

  it("lets a clearly on-point question win regardless of which section it was asked from", () => {
    const hits = retrieveKnowledge(
      "how do overnights and time-sharing change the calculation?",
      topicRetrievalOptions("children"),
    );
    expect(hits[0]?.entry.id).toBe("child-support-overnights");
  });

  it("re-ranks toward the section's material when the question already matched", () => {
    const question = "how are retirement accounts and property divided?";
    const neutral = retrieveKnowledge(question);
    const fromAssets = retrieveKnowledge(question, topicRetrievalOptions("assetsDebts"));

    // Same entries qualify either way — the topic only reorders them.
    expect(new Set(fromAssets.map((hit) => hit.entry.id))).toEqual(
      new Set(neutral.map((hit) => hit.entry.id)),
    );
    expect(fromAssets.map((hit) => hit.entry.id)).toContain("retirement-accounts");
  });

  it("is a no-op without a topic", () => {
    expect(topicRetrievalOptions(undefined)).toEqual({});
  });
});
