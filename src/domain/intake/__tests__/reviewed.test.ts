import { describe, expect, it } from "vitest";

import { createEmptyDraft } from "../draft";
import { createDemoDraft } from "../demoDraft";
import { buildReviewedDraft, DraftNotReadyError } from "../reviewed";
import { createInMemoryIntakeDraftStorage } from "../storage";

describe("buildReviewedDraft", () => {
  it("throws DraftNotReadyError for an incomplete draft", () => {
    const draft = createEmptyDraft();
    expect(() => buildReviewedDraft(draft)).toThrow(DraftNotReadyError);
  });

  it("returns a fully-typed snapshot for a complete draft, omitting non-applicable topics", () => {
    const demo = createDemoDraft();
    const reviewed = buildReviewedDraft(demo);
    expect(reviewed.data.caseBasics.county).toContain("Sample County");
    expect(reviewed.data.parentingTime).toBeDefined();
    expect(reviewed.data.childCosts).toBeDefined();
    expect(reviewed.isDemo).toBe(true);
    expect(reviewed.reviewedAt).toEqual(expect.any(String));
  });

  it("omits parentingTime and childCosts for a childless, otherwise-complete draft", () => {
    const demo = createDemoDraft();
    demo.data.children = { hasChildren: "no", children: [] };
    const reviewed = buildReviewedDraft(demo);
    expect(reviewed.data.parentingTime).toBeUndefined();
    expect(reviewed.data.childCosts).toBeUndefined();
  });
});

describe("createInMemoryIntakeDraftStorage", () => {
  it("round-trips a draft through save/load/clear", async () => {
    const storage = createInMemoryIntakeDraftStorage();
    expect(await storage.load()).toBeNull();

    const draft = createEmptyDraft();
    draft.data.caseBasics.county = "Duval";
    await storage.save(draft);

    const loaded = await storage.load();
    expect(loaded?.data.caseBasics.county).toBe("Duval");

    await storage.clear();
    expect(await storage.load()).toBeNull();
  });
});
