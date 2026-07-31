import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { describe, expect, it } from "vitest";

import { buildReviewedDraft, } from "@/domain/intake";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import { isConfirmedFact, unwrapConfirmedFact } from "@/domain/rules";

import { mapReviewedDraftToChildSupportInput } from "../childSupportMapper";

function demoReviewedDraft(): ReviewedIntakeDraft {
  return buildReviewedDraft(createSampleDraft());
}

/** Deep-clones a reviewed draft so tests can mutate it without cross-contamination. */
function clone(reviewed: ReviewedIntakeDraft): ReviewedIntakeDraft {
  return JSON.parse(JSON.stringify(reviewed)) as ReviewedIntakeDraft;
}

describe("mapReviewedDraftToChildSupportInput", () => {
  it("converts intake dollar amounts to integer cents and sums every gross-income category", () => {
    const reviewed = demoReviewedDraft();
    const result = mapReviewedDraftToChildSupportInput(reviewed);

    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;
    expect(isConfirmedFact(result.value)).toBe(true);

    const input = unwrapConfirmedFact(result.value);
    const self = reviewed.data.income.self;
    const expectedSelfGrossDollars =
      self.wages +
      self.selfEmploymentIncome +
      self.bonusesAndCommissions +
      self.investmentIncome +
      self.rentalIncome +
      self.retirementOrPensionIncome +
      self.unemploymentBenefits +
      self.disabilityBenefits +
      self.otherIncome;

    const parent1 = input.parents.find((p) => p.parentId === "parent1");
    expect(parent1?.monthlyGrossIncomeCents).toBe(Math.round(expectedSelfGrossDollars * 100));

    // Every emitted monetary value must be an integer number of cents.
    expect(Number.isInteger(parent1?.monthlyGrossIncomeCents)).toBe(true);
    expect(Number.isInteger(input.monthlyChildCareCostsCents)).toBe(true);
    expect(input.monthlyChildCareCostsCents).toBe(
      Math.round(reviewed.data.childCosts!.childCareCostMonthly * 100),
    );
  });

  it("never counts union dues as a statutory deduction", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.deductions.self.unionDues = 500;
    reviewed.data.deductions.spouse.unionDues = 250;

    const withoutDues = mapReviewedDraftToChildSupportInput(demoReviewedDraft());
    const withDues = mapReviewedDraftToChildSupportInput(reviewed);

    expect(withoutDues.kind).toBe("mapped");
    expect(withDues.kind).toBe("mapped");
    if (withoutDues.kind !== "mapped" || withDues.kind !== "mapped") return;

    const before = unwrapConfirmedFact(withoutDues.value);
    const after = unwrapConfirmedFact(withDues.value);
    // Adding union dues must not change any mapped deduction figure.
    expect(after).toEqual(before);

    // And the resulting deduction schema has no field that could hold union dues at all.
    const deductionKeys = Object.keys(after.parents[0].deductions);
    expect(deductionKeys.some((key) => /union/i.test(key))).toBe(false);
  });

  it("maps other-child support and prior spousal support into separate statutory deductions", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.deductions.self.courtOrderedChildSupportPaidForOtherChildren = 300;
    reviewed.data.deductions.self.spousalSupportPaidUnderPriorOrder = 125;

    const result = mapReviewedDraftToChildSupportInput(reviewed);
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;

    const input = unwrapConfirmedFact(result.value);
    const parent1 = input.parents.find((p) => p.parentId === "parent1");
    expect(parent1?.deductions.courtOrderedSupportForOtherChildrenPaidCents).toBe(30_000);
    expect(parent1?.deductions.spousalSupportPaidUnderPriorOrderCents).toBe(12_500);
  });

  it("maps only the directly confirmed per-parent child-care and health prepayments", () => {
    const result = mapReviewedDraftToChildSupportInput(demoReviewedDraft());
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;

    const input = unwrapConfirmedFact(result.value);
    expect(input.parents[0].childCarePrepaidCents).toBe(32_500);
    expect(input.parents[0].childHealthCostsPrepaidCents).toBe(18_000);
    expect(input.parents[1].childCarePrepaidCents).toBe(32_500);
    expect(input.parents[1].childHealthCostsPrepaidCents).toBe(0);
  });

  it("returns a typed, non-blocking issue for unsupported extraordinary costs rather than dropping them silently", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.childCosts!.extraordinaryMedicalCostsMonthly = 75;

    const result = mapReviewedDraftToChildSupportInput(reviewed);
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;
    expect(result.issues.some((issue) => issue.code === "unsupported-extraordinary-child-costs")).toBe(true);
  });

  it("returns unmapped with an info issue when there are no shared minor children", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.children.hasChildren = "no";
    reviewed.data.children.children = [];
    reviewed.data.parentingTime = undefined;
    reviewed.data.childCosts = undefined;

    const result = mapReviewedDraftToChildSupportInput(reviewed);
    expect(result.kind).toBe("unmapped");
    if (result.kind !== "unmapped") return;
    expect(result.issues[0].code).toBe("no-shared-minor-children");
    expect(result.issues[0].severity).toBe("info");
  });

  it("returns unmapped with a blocking issue when parenting-time or child-cost data is missing despite having children", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.parentingTime = undefined;

    const result = mapReviewedDraftToChildSupportInput(reviewed);
    expect(result.kind).toBe("unmapped");
    if (result.kind !== "unmapped") return;
    expect(result.issues[0].code).toBe("insufficient-child-support-data");
    expect(result.issues[0].severity).toBe("blocking");
  });
});
