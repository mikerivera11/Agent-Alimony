import { describe, expect, it } from "vitest";

import {
  EMPTY_INTAKE_DRAFT_DATA,
  createEmptyDraft,
  normalizeDraft,
  normalizeDraftData,
  type IntakeDraftData,
} from "../draft";
import { INTAKE_STEP_ORDER } from "../steps";

/**
 * Drafts are stored as plain JSON and read back with a cast, so one saved
 * before a step existed comes back without that key. Every screen indexes
 * straight into `data[stepId]`, so the gap has to be closed on the way in.
 */
describe("normalizeDraftData", () => {
  it("supplies every step a stored draft predates", () => {
    const legacy = { caseBasics: { county: "Hillsborough" } } as Partial<IntakeDraftData>;

    const normalized = normalizeDraftData(legacy);

    for (const stepId of INTAKE_STEP_ORDER) {
      expect(normalized[stepId], `missing ${stepId}`).toBeDefined();
    }
  });

  it("keeps every stored answer rather than resetting to the empty shape", () => {
    const normalized = normalizeDraftData({
      caseBasics: { county: "Hillsborough", petitionDate: "2026-01-15" },
    } as Partial<IntakeDraftData>);

    expect(normalized.caseBasics).toEqual({ county: "Hillsborough", petitionDate: "2026-01-15" });
  });

  it("does not treat a deliberately empty answer as missing", () => {
    // `{}` is what a step someone skipped looks like, and it must survive as
    // itself rather than being confused with a step that was never there.
    const normalized = normalizeDraftData({ caseBasics: {} } as Partial<IntakeDraftData>);

    expect(normalized.caseBasics).toEqual({});
  });

  it("returns a fresh copy so the shared empty draft cannot be mutated", () => {
    const normalized = normalizeDraftData(undefined);
    normalized.caseBasics = { county: "Leon" };

    expect(EMPTY_INTAKE_DRAFT_DATA.caseBasics).toEqual({});
  });

  it("leaves a current draft untouched", () => {
    const current = createEmptyDraft();

    expect(normalizeDraft(current).data).toEqual(current.data);
  });

  it("preserves the envelope while repairing the data", () => {
    const draft = createEmptyDraft();
    const legacy = { ...draft, data: { caseBasics: { county: "Duval" } } as IntakeDraftData };

    const normalized = normalizeDraft(legacy);

    expect(normalized.draftId).toBe(draft.draftId);
    expect(normalized.createdAt).toBe(draft.createdAt);
    expect(normalized.data.caseBasics).toEqual({ county: "Duval" });
    expect(normalized.data.children).toEqual({ children: [] });
  });
});
