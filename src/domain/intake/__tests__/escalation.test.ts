import { describe, expect, it } from "vitest";

import { createEmptyDraft } from "../draft";
import { assessEscalation } from "../escalation";

describe("assessEscalation", () => {
  it("flags a safety concern when domestic violence or coercion is reported", () => {
    const draft = createEmptyDraft();
    draft.data.safetyComplexity.domesticViolenceOrCoercion = "yes";
    expect(assessEscalation(draft.data).safetyConcern).toBe(true);
  });

  it("has no attorney flags for a clean, simple draft", () => {
    const draft = createEmptyDraft();
    expect(assessEscalation(draft.data).attorneyFlags).toEqual([]);
  });

  it("flags hidden assets, complex business income, jurisdiction disputes, disputed income, and pre-2023 filings", () => {
    const draft = createEmptyDraft();
    draft.data.assetsDebts.hasHiddenOrUnknownAssets = "yes";
    draft.data.assetsDebts.hasComplexBusinessInterests = "yes";
    draft.data.safetyComplexity.hasJurisdictionDispute = "yes";
    draft.data.safetyComplexity.incomeIsImputedOrDisputed = "yes";
    draft.data.safetyComplexity.filedOrFilingBeforeJuly2023 = "yes";

    const flags = assessEscalation(draft.data).attorneyFlags.map((flag) => flag.id);
    expect(flags).toEqual(
      expect.arrayContaining([
        "hidden-assets",
        "complex-business",
        "jurisdiction-dispute",
        "imputed-disputed-income",
        "pre-2023-filing",
      ]),
    );
  });

  it("flags a special-needs child", () => {
    const draft = createEmptyDraft();
    draft.data.children.hasChildren = "yes";
    draft.data.children.children = [
      {
        id: "1",
        nameOrInitials: "A.B.",
        dateOfBirth: "2016-01-01",
        hasSpecialNeeds: "yes",
        specialNeedsDetails: "Needs weekly therapy.",
      },
    ];
    const flags = assessEscalation(draft.data).attorneyFlags.map((flag) => flag.id);
    expect(flags).toContain("special-needs-child");
  });
});
