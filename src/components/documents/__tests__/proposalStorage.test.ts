import { describe, expect, it } from "vitest";

import {
  createProposalDecisionRecord,
  deserializeProposalDecisions,
  PROPOSAL_DECISIONS_STORAGE_KEY,
  serializeProposalDecisions,
  transitionProposalDecision,
  type ProposalDecisionsState,
} from "../proposalStorage";

describe("proposal decision state transitions", () => {
  it("starts every proposal as 'proposed', never pre-confirmed", () => {
    const record = createProposalDecisionRecord("p1", "case.children.count", 2);
    expect(record.status).toBe("proposed");
    expect(record.decidedAt).toBeNull();
    expect(record.editedValue).toBeNull();
    expect(record.originalValue).toBe(2);
  });

  it("confirm transitions proposed -> confirmed and stamps decidedAt", () => {
    const record = createProposalDecisionRecord("p1", "field", 100);
    const confirmed = transitionProposalDecision(record, { type: "confirm" });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.decidedAt).not.toBeNull();
    expect(confirmed.editedValue).toBeNull();
  });

  it("reject transitions proposed -> rejected and stamps decidedAt", () => {
    const record = createProposalDecisionRecord("p1", "field", 100);
    const rejected = transitionProposalDecision(record, { type: "reject" });
    expect(rejected.status).toBe("rejected");
    expect(rejected.decidedAt).not.toBeNull();
  });

  it("start_edit -> update_edit_value -> confirm carries the edited value forward, never the raw proposed value silently", () => {
    const record = createProposalDecisionRecord("p1", "field", 100);
    const editing = transitionProposalDecision(record, { type: "start_edit" });
    expect(editing.status).toBe("editing");

    const updated = transitionProposalDecision(editing, { type: "update_edit_value", value: 250 });
    expect(updated.status).toBe("editing");
    expect(updated.editedValue).toBe(250);

    const confirmed = transitionProposalDecision(updated, { type: "confirm", value: 250 });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.editedValue).toBe(250);
    expect(confirmed.originalValue).toBe(100); // original is never mutated
  });

  it("cancel_edit returns to proposed and discards the in-progress edit", () => {
    const record = createProposalDecisionRecord("p1", "field", 100);
    const editing = transitionProposalDecision(record, { type: "start_edit" });
    const updated = transitionProposalDecision(editing, { type: "update_edit_value", value: 999 });
    const cancelled = transitionProposalDecision(updated, { type: "cancel_edit" });
    expect(cancelled.status).toBe("proposed");
    expect(cancelled.editedValue).toBeNull();
  });

  it("reset returns a confirmed or rejected proposal back to proposed (undo)", () => {
    const record = createProposalDecisionRecord("p1", "field", 100);
    const confirmed = transitionProposalDecision(record, { type: "confirm" });
    const reset = transitionProposalDecision(confirmed, { type: "reset" });
    expect(reset.status).toBe("proposed");
    expect(reset.decidedAt).toBeNull();

    const rejected = transitionProposalDecision(record, { type: "reject" });
    const resetRejected = transitionProposalDecision(rejected, { type: "reset" });
    expect(resetRejected.status).toBe("proposed");
  });

  it("ignores actions that are not valid for the current status instead of throwing or silently succeeding", () => {
    const record = createProposalDecisionRecord("p1", "field", 100);
    const confirmed = transitionProposalDecision(record, { type: "confirm" });
    // Cannot "update_edit_value" on an already-confirmed, non-editing record.
    const attempted = transitionProposalDecision(confirmed, { type: "update_edit_value", value: 42 });
    expect(attempted).toBe(confirmed);
    expect(attempted.status).toBe("confirmed");
  });

  it("never auto-confirms: no transition function produces 'confirmed' without an explicit confirm action", () => {
    const record = createProposalDecisionRecord("p1", "field", 100);
    const actions = ["start_edit", "update_edit_value", "cancel_edit", "reject", "reset"] as const;
    for (const type of actions) {
      const result = transitionProposalDecision(record, { type, value: 1 } as never);
      expect(result.status).not.toBe("confirmed");
    }
  });
});

describe("proposal decisions serialization", () => {
  it("round-trips through JSON without losing data", () => {
    const state: ProposalDecisionsState = {
      p1: createProposalDecisionRecord("p1", "field.one", 42),
      p2: transitionProposalDecision(createProposalDecisionRecord("p2", "field.two", "text value"), {
        type: "reject",
      }),
    };

    const serialized = serializeProposalDecisions(state);
    const deserialized = deserializeProposalDecisions(serialized);
    expect(deserialized).toEqual(state);
  });

  it("returns an empty state for malformed JSON rather than throwing", () => {
    expect(deserializeProposalDecisions("not json{{{")).toEqual({});
    expect(deserializeProposalDecisions("[1,2,3]")).toEqual({});
    expect(deserializeProposalDecisions("null")).toEqual({});
  });

  it("uses a stable, namespaced storage key", () => {
    expect(PROPOSAL_DECISIONS_STORAGE_KEY).toBe("florida-support-guide.documents.proposal-decisions.v1");
  });
});
