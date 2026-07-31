/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";

import {
  clearProposalDecisions,
  createProposalDecisionRecord,
  loadProposalDecisions,
  PROPOSAL_DECISIONS_STORAGE_KEY,
  saveProposalDecisions,
} from "../proposalStorage";

afterEach(() => {
  window.localStorage.clear();
});

describe("proposal decisions localStorage persistence", () => {
  it("saves and loads decisions under the namespaced key only", () => {
    const state = { p1: createProposalDecisionRecord("p1", "field.one", 10) };
    saveProposalDecisions(state);

    expect(window.localStorage.getItem(PROPOSAL_DECISIONS_STORAGE_KEY)).not.toBeNull();
    expect(loadProposalDecisions()).toEqual(state);
  });

  it("does not write to any other localStorage key", () => {
    saveProposalDecisions({ p1: createProposalDecisionRecord("p1", "field", 1) });
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.key(0)).toBe(PROPOSAL_DECISIONS_STORAGE_KEY);
  });

  it("clearProposalDecisions removes the stored state", () => {
    saveProposalDecisions({ p1: createProposalDecisionRecord("p1", "field", 1) });
    clearProposalDecisions();
    expect(loadProposalDecisions()).toEqual({});
  });

  it("loadProposalDecisions returns an empty object when nothing is stored", () => {
    expect(loadProposalDecisions()).toEqual({});
  });
});
