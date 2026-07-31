import { describe, expect, it } from "vitest";

import { createEmptyDraft } from "../draft";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { buildReviewedDraft, DraftNotReadyError, isReviewedSnapshotStale } from "../reviewed";
import { createInMemoryIntakeDraftStorage } from "../storage";

describe("buildReviewedDraft", () => {
  it("throws DraftNotReadyError for an incomplete draft", () => {
    const draft = createEmptyDraft();
    expect(() => buildReviewedDraft(draft)).toThrow(DraftNotReadyError);
  });

  it("returns a fully-typed snapshot for a complete draft, omitting non-applicable topics", () => {
    const sample = createSampleDraft();
    const reviewed = buildReviewedDraft(sample);
    expect(reviewed.data.caseBasics.county).toContain("Sample County");
    expect(reviewed.data.parentingTime).toBeDefined();
    expect(reviewed.data.childCosts).toBeDefined();
    expect(reviewed.reviewedAt).toEqual(expect.any(String));
  });

  it("omits parentingTime and childCosts for a childless, otherwise-complete draft", () => {
    const sample = createSampleDraft();
    sample.data.children = { hasChildren: "no", children: [] };
    const reviewed = buildReviewedDraft(sample);
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

describe("isReviewedSnapshotStale", () => {
  const draftId = "draft-1";

  function reviewed(reviewedAt: string, id = draftId) {
    return { draftId: id, reviewedAt };
  }
  function draft(updatedAt: string, id = draftId) {
    return { draftId: id, updatedAt };
  }

  it("is not stale when the answers have not changed since review", () => {
    expect(
      isReviewedSnapshotStale(reviewed("2026-07-31T12:00:00.000Z"), draft("2026-07-31T11:59:00.000Z")),
    ).toBe(false);
  });

  it("is not stale when the draft was updated at the exact review instant", () => {
    expect(
      isReviewedSnapshotStale(reviewed("2026-07-31T12:00:00.000Z"), draft("2026-07-31T12:00:00.000Z")),
    ).toBe(false);
  });

  it("is stale once an answer changes after review", () => {
    expect(
      isReviewedSnapshotStale(reviewed("2026-07-31T12:00:00.000Z"), draft("2026-07-31T12:00:01.000Z")),
    ).toBe(true);
  });

  it("is stale when the snapshot describes a different draft entirely", () => {
    expect(
      isReviewedSnapshotStale(
        reviewed("2026-07-31T12:00:00.000Z"),
        draft("2026-07-31T11:00:00.000Z", "draft-2"),
      ),
    ).toBe(true);
  });

  it("treats unparseable timestamps as stale rather than vouching for the figures", () => {
    expect(isReviewedSnapshotStale(reviewed("not-a-date"), draft("2026-07-31T12:00:00.000Z"))).toBe(true);
    expect(isReviewedSnapshotStale(reviewed("2026-07-31T12:00:00.000Z"), draft("nope"))).toBe(true);
  });

  it("is not stale when either side is missing — there is nothing to contradict", () => {
    expect(isReviewedSnapshotStale(null, draft("2026-07-31T12:00:00.000Z"))).toBe(false);
    expect(isReviewedSnapshotStale(reviewed("2026-07-31T12:00:00.000Z"), null)).toBe(false);
    expect(isReviewedSnapshotStale(null, null)).toBe(false);
  });

  it("is not stale for a real reviewed draft built from a complete sample", () => {
    const sample = createSampleDraft();
    const snapshot = buildReviewedDraft(sample);
    expect(isReviewedSnapshotStale(snapshot, sample)).toBe(false);
  });
});
