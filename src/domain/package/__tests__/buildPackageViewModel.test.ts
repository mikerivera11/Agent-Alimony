import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { describe, expect, it } from "vitest";

import { buildReviewedDraft, } from "@/domain/intake";
import type { ReviewedIntakeDraft } from "@/domain/intake";

import { buildPackageViewModel } from "../buildPackageViewModel";
import { PACKAGE_DISCLAIMER_BODY, PACKAGE_DISCLAIMER_HEADING } from "../disclaimer";

function demoReviewedDraft(): ReviewedIntakeDraft {
  return buildReviewedDraft(createSampleDraft());
}

describe("buildPackageViewModel", () => {
  it("includes every required section", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());

    expect(viewModel.draftId).toBeTruthy();
    expect(viewModel.generatedAt).toBeTruthy();
    expect(viewModel.confirmedFacts.length).toBeGreaterThan(0);
    expect(Array.isArray(viewModel.missingOrUnsupported)).toBe(true);
    expect(viewModel.sources.length).toBeGreaterThan(0);
    expect(viewModel.childSupport).toBeDefined();
    expect(viewModel.alimony).toBeDefined();
    expect(viewModel.assumptions.length).toBeGreaterThan(0);
    expect(viewModel.verifications.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(viewModel.scenarios)).toBe(true);
  });

  it("every confirmed fact is tagged user-entered provenance", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    for (const entry of viewModel.confirmedFacts) {
      expect(entry.provenance).toBe("user-entered");
    }
  });

  it("does not mislabel a legacy narrative holiday schedule as an agreement", () => {
    const reviewed = demoReviewedDraft();
    const legacyParentingPlan = { ...reviewed.data.parentingPlan } as Record<string, unknown>;
    delete legacyParentingPlan.holidayScheduleMode;
    delete legacyParentingPlan.holidaySchedules;
    legacyParentingPlan.holidaySchedule = "The parents alternate holidays under their existing written schedule.";

    const viewModel = buildPackageViewModel({
      ...reviewed,
      data: {
        ...reviewed.data,
        parentingPlan: legacyParentingPlan as ReviewedIntakeDraft["data"]["parentingPlan"],
      },
    });

    expect(
      viewModel.confirmedFacts.find((entry) => entry.label === "Holiday schedule method")?.value,
    ).toBe("Legacy narrative schedule");
  });

  it("shows a prominent attorney-review disclaimer with no binding-agreement language", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    expect(viewModel.disclaimer).toContain(PACKAGE_DISCLAIMER_HEADING);
    expect(viewModel.disclaimer).toContain(PACKAGE_DISCLAIMER_BODY);
    expect(viewModel.disclaimer.toLowerCase()).toContain("not legal advice");
    expect(viewModel.disclaimer.toLowerCase()).not.toContain("this agreement");
    expect(viewModel.disclaimer.toLowerCase()).not.toContain("binding upon signature");
  });

  it("includes statutory citations for both child support and alimony", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    const citationStrings = viewModel.sources.map((source) => source.citation);
    expect(citationStrings).toContain("Fla. Stat. §61.30");
    expect(citationStrings).toContain("Fla. Stat. §61.08");
  });

  it("calculates a real child support outcome from the demo draft, with a full formula trace", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    expect(viewModel.childSupport.kind).toBe("calculated");
    if (viewModel.childSupport.kind !== "calculated") return;
    expect(viewModel.childSupport.formulaTrace.length).toBeGreaterThan(0);
  });

  it("calculates an alimony planning range from explicit confirmed inputs", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    expect(viewModel.alimony.kind).toBe("calculated");
    if (viewModel.alimony.kind !== "calculated") return;
    expect(viewModel.alimony.result.amountCeiling.rangeFloorCents).toBe(0);
    expect(viewModel.alimony.result.amountCeiling.rangeCeilingCents).toBeGreaterThan(0);
    expect(viewModel.alimony.formulaTrace.length).toBeGreaterThan(0);
  });

  it("includes ruleset/source verification dates", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    for (const verification of viewModel.verifications) {
      expect(verification.sourceVerifiedAt).toBeTruthy();
      expect(verification.effectiveDate).toBeTruthy();
    }
  });

  it("calculates an equitable-distribution outcome with both exclusion scenarios", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    expect(viewModel.equitableDistribution.kind).toBe("calculated");
    if (viewModel.equitableDistribution.kind !== "calculated") return;
    const result = viewModel.equitableDistribution.result;
    expect(result.distributionWithExclusions).toBeDefined();
    expect(result.baselineWithoutExclusions).toBeDefined();
    // The demo excludes the retirement account by a confirmed written
    // agreement, so the with/without-exclusion estates must differ.
    expect(result.distributionWithExclusions.netMaritalEstateCents).not.toBe(
      result.baselineWithoutExclusions.netMaritalEstateCents,
    );
    expect(result.nonmaritalSetAside.items.length).toBeGreaterThan(0);
    // Excluding a retirement asset must surface the QDRO warning.
    expect(viewModel.equitableDistribution.warnings.some((w) => w.flagId.startsWith("retirementExclusion"))).toBe(
      true,
    );
  });

  it("includes §61.075 as a source citation", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    expect(viewModel.sources.map((s) => s.citation)).toContain("Fla. Stat. §61.075");
  });

  it("builds an illustrative lump-sum model with a sensitivity band and disclosures", () => {
    const viewModel = buildPackageViewModel(demoReviewedDraft());
    expect(viewModel.lumpSum.available).toBe(true);
    expect(viewModel.lumpSum.model).not.toBeNull();
    if (!viewModel.lumpSum.model) return;
    expect(viewModel.lumpSum.model.range.length).toBeGreaterThan(1);
    expect(viewModel.lumpSum.model.warnings.length).toBeGreaterThan(0);
    expect(viewModel.lumpSum.model.assumptions.some((a) => a.toLowerCase().includes("not set by florida law"))).toBe(
      true,
    );
  });
});
