import { describe, expect, it } from "vitest";

import type { ExtractionProposalRecord } from "./schemas";
import { mapConfirmedProposalsToFacts } from "./facts";

function makeProposal(
  overrides: Partial<ExtractionProposalRecord> & Pick<ExtractionProposalRecord, "status">,
): ExtractionProposalRecord {
  return {
    id: "proposal-1",
    extractionRunId: "run-1",
    caseId: "case-1",
    fieldKey: "participant.petitioner.grossMonthlyIncome",
    value: 4200,
    confirmedValue: null,
    sourceDocumentId: "doc-1",
    sourcePage: 1,
    sourceLocation: null,
    confidence: 0.9,
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmedAt: null,
    ...overrides,
  };
}

describe("mapConfirmedProposalsToFacts — proof only confirmed proposals become facts", () => {
  it("maps a confirmed proposal to a calculation fact", () => {
    const proposal = makeProposal({ id: "p1", status: "confirmed", confirmedValue: 4500, confirmedAt: new Date() });
    const facts = mapConfirmedProposalsToFacts([proposal]);

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      fieldKey: proposal.fieldKey,
      value: 4500,
      sourceDocumentId: "doc-1",
      sourceProposalId: "p1",
    });
  });

  it("excludes 'proposed' (not yet reviewed) proposals", () => {
    const proposal = makeProposal({ id: "p1", status: "proposed" });
    expect(mapConfirmedProposalsToFacts([proposal])).toHaveLength(0);
  });

  it("excludes 'rejected' proposals", () => {
    const proposal = makeProposal({ id: "p1", status: "rejected" });
    expect(mapConfirmedProposalsToFacts([proposal])).toHaveLength(0);
  });

  it("from a mixed batch, produces facts for confirmed rows ONLY — proposed/rejected never leak through", () => {
    const proposed = makeProposal({ id: "p-proposed", status: "proposed", fieldKey: "case.children.count", value: 99 });
    const rejected = makeProposal({ id: "p-rejected", status: "rejected", fieldKey: "participant.respondent.grossMonthlyIncome", value: 1 });
    const confirmedA = makeProposal({ id: "p-confirmed-a", status: "confirmed", confirmedValue: 4200, confirmedAt: new Date() });
    const confirmedB = makeProposal({
      id: "p-confirmed-b",
      status: "confirmed",
      fieldKey: "participant.respondent.grossMonthlyIncome",
      value: 3100,
      confirmedValue: 3100,
      confirmedAt: new Date(),
    });

    const facts = mapConfirmedProposalsToFacts([proposed, rejected, confirmedA, confirmedB]);
    const factIds = facts.map((f) => f.sourceProposalId).sort();

    expect(factIds).toEqual(["p-confirmed-a", "p-confirmed-b"]);
    expect(facts.some((f) => f.sourceProposalId === "p-proposed")).toBe(false);
    expect(facts.some((f) => f.sourceProposalId === "p-rejected")).toBe(false);
  });

  it("prefers the confirmedValue (post-edit) over the originally proposed value", () => {
    const proposal = makeProposal({
      id: "p1",
      status: "confirmed",
      value: 4200, // originally proposed
      confirmedValue: 4500, // user corrected before confirming
      confirmedAt: new Date(),
    });
    const [fact] = mapConfirmedProposalsToFacts([proposal]);
    expect(fact.value).toBe(4500);
  });

  it("falls back to the proposed value only if no distinct confirmedValue was recorded", () => {
    const proposal = makeProposal({ id: "p1", status: "confirmed", value: 4200, confirmedValue: null, confirmedAt: new Date() });
    const [fact] = mapConfirmedProposalsToFacts([proposal]);
    expect(fact.value).toBe(4200);
  });

  it("an empty input list produces an empty fact list", () => {
    expect(mapConfirmedProposalsToFacts([])).toEqual([]);
  });
});
