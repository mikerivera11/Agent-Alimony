import { describe, expect, it } from "vitest";

import { createEmptyDraft } from "../draft";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { getMissingDataSummary, isDraftReadyForReview } from "../missingData";
import { getApplicableStepIds } from "../steps";

describe("getApplicableStepIds", () => {
  it("excludes parentingTime and childCosts when there are no children", () => {
    const draft = createEmptyDraft();
    draft.data.children.hasChildren = "no";
    const ids = getApplicableStepIds(draft.data);
    expect(ids).not.toContain("parentingTime");
    expect(ids).not.toContain("childCosts");
  });

  it("includes parentingTime and childCosts when there are children", () => {
    const draft = createEmptyDraft();
    draft.data.children.hasChildren = "yes";
    const ids = getApplicableStepIds(draft.data);
    expect(ids).toContain("parentingTime");
    expect(ids).toContain("childCosts");
  });
});

describe("getMissingDataSummary", () => {
  it("reports every applicable topic as missing for a brand-new draft", () => {
    const draft = createEmptyDraft();
    const summary = getMissingDataSummary(draft);
    // A fresh draft answers nothing, so every always-applicable topic is incomplete.
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.some((entry) => entry.stepId === "caseBasics")).toBe(true);
  });

  it("does not flag topics that don't apply to this household", () => {
    const draft = createEmptyDraft();
    draft.data.children.hasChildren = "no";
    const summary = getMissingDataSummary(draft);
    expect(summary.some((entry) => entry.stepId === "parentingTime")).toBe(false);
    expect(summary.some((entry) => entry.stepId === "childCosts")).toBe(false);
  });

  it("is empty for the fully completed demo draft", () => {
    const draft = createSampleDraft();
    const summary = getMissingDataSummary(draft);
    expect(summary).toEqual([]);
    expect(isDraftReadyForReview(draft)).toBe(true);
  });

  it("is not ready for review on a brand-new draft", () => {
    const draft = createEmptyDraft();
    expect(isDraftReadyForReview(draft)).toBe(false);
  });
});
