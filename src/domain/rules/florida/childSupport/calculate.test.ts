import { describe, expect, it } from "vitest";

import { confirmFact } from "../../confirmedFact";
import { UnconfirmedInputError } from "../../confirmedFact";
import {
  calculateFloridaChildSupport,
  type ChildSupportInput,
} from "./index";

function baseParent(overrides: Partial<ChildSupportInput["parents"][number]> = {}) {
  return {
    parentId: "parent1" as const,
    monthlyGrossIncomeCents: 0,
    deductions: {
      federalStateLocalIncomeTaxCents: 0,
      ficaOrSelfEmploymentTaxCents: 0,
      mandatoryRetirementCents: 0,
      healthInsurancePremiumSelfOnlyCents: 0,
      courtOrderedSupportForOtherChildrenPaidCents: 0,
      spousalSupportPaidUnderPriorOrderCents: 0,
    },
    overnightsWithChild: 0,
    childCarePrepaidCents: 0,
    childHealthCostsPrepaidCents: 0,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ChildSupportInput> = {}): ChildSupportInput {
  return {
    numberOfChildren: 1,
    totalNightsInPeriod: 365,
    monthlyChildCareCostsCents: 0,
    monthlyChildHealthInsuranceCents: 0,
    parents: [
      baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 320 }),
      baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 45 }),
    ],
    ...overrides,
  } as ChildSupportInput;
}

describe("calculateFloridaChildSupport — standard branch", () => {
  it("computes the equal-income, low-time-sharing case against the $5,000 schedule row", () => {
    const outcome = calculateFloridaChildSupport(confirmFact(baseInput(), "user-entered"));
    expect(outcome.kind).toBe("calculated");
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.combinedNetMonthlyIncomeCents).toBe(500_000);
    expect(outcome.result.basicMonthlyNeedCents).toBe(100_000);
    expect(outcome.result.totalMinimumChildSupportNeedCents).toBe(100_000);
    expect(outcome.result.substantialTimeSharingApplied).toBe(false);
    expect(outcome.result.obligorParentId).toBe("parent2");
    expect(outcome.result.monthlyTransferAmountCents).toBe(50_000);
  });

  it("applies child-care/health add-ons and the obligor's own prepaid credit", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          monthlyChildCareCostsCents: 10_000,
          monthlyChildHealthInsuranceCents: 6_000,
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 320 }),
            baseParent({
              parentId: "parent2",
              monthlyGrossIncomeCents: 250_000,
              overnightsWithChild: 45,
              childCarePrepaidCents: 8_000,
            }),
          ],
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.totalMinimumChildSupportNeedCents).toBe(116_000);
    expect(outcome.result.parents[1].dollarShareOfTotalNeedCents).toBe(58_000);
    // 58,000 dollar share minus the obligor's own 8,000 prepaid credit.
    expect(outcome.result.monthlyTransferAmountCents).toBe(50_000);
  });

  it("credits an obligor-attributable Social Security child benefit", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          socialSecurityChildBenefitCredit: {
            attributableToParentId: "parent2",
            monthlyBenefitPaidToChildOrCaregiverCents: 20_000,
          },
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.socialSecurityCreditAppliedCents).toBe(20_000);
    expect(outcome.result.monthlyTransferAmountCents).toBe(30_000);
    expect(outcome.warnings.some((w) => w.flagId.startsWith("socialSecurityBenefit"))).toBe(false);
  });

  it("flags but does not apply a Social Security credit not attributable to the obligor", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          socialSecurityChildBenefitCredit: {
            attributableToParentId: "parent1",
            monthlyBenefitPaidToChildOrCaregiverCents: 20_000,
          },
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.socialSecurityCreditAppliedCents).toBe(0);
    expect(outcome.result.monthlyTransferAmountCents).toBe(50_000);
    expect(
      outcome.warnings.some((w) => w.flagId === "socialSecurityCreditNotAttributableToObligor"),
    ).toBe(true);
  });

  it("surfaces the >55%-of-gross-income deviation factor as a warning, never as a clamp", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          monthlyChildCareCostsCents: 200_000,
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 80_000, overnightsWithChild: 320 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 80_000, overnightsWithChild: 45 }),
          ],
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    // 118,000 dollar share on an 80,000 gross income obligor — no clamp applied.
    expect(outcome.result.monthlyTransferAmountCents).toBe(118_000);
    expect(
      outcome.warnings.some((w) => w.flagId === "obligationExceeds55PercentOfGrossIncome"),
    ).toBe(true);
  });
});

describe("calculateFloridaChildSupport — 20% substantial-time-sharing threshold", () => {
  it("does not apply the gross-up formula just under the 20% threshold", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 293 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 72 }),
          ],
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.substantialTimeSharingApplied).toBe(false);
  });

  it("applies the gross-up formula exactly at the 20% threshold", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 292 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 73 }),
          ],
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.substantialTimeSharingApplied).toBe(true);
  });

  it("measures each parent's percentage against the annual period, not assigned nights", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 210 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 60 }),
          ],
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.parents[1].overnightSharePercentBasisPoints).toBe(1_644);
    expect(outcome.result.substantialTimeSharingApplied).toBe(false);
  });
});

describe("calculateFloridaChildSupport — gross-up (substantial time-sharing) branch", () => {
  it("computes the 1.5x gross-up formula with add-ons, prepaid credits, and an SS credit", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          monthlyChildCareCostsCents: 20_000,
          monthlyChildHealthInsuranceCents: 10_000,
          socialSecurityChildBenefitCredit: {
            attributableToParentId: "parent1",
            monthlyBenefitPaidToChildOrCaregiverCents: 3_000,
          },
          parents: [
            baseParent({
              parentId: "parent1",
              monthlyGrossIncomeCents: 300_000,
              overnightsWithChild: 200,
              childCarePrepaidCents: 5_000,
            }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 200_000, overnightsWithChild: 165 }),
          ],
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.substantialTimeSharingApplied).toBe(true);
    expect(outcome.result.basicMonthlyNeedCents).toBe(100_000);
    expect(outcome.result.obligorParentId).toBe("parent1");
    // base transfer 7,815 + add-on adjustment 1,000 - 3,000 SS credit = 5,815.
    expect(outcome.result.monthlyTransferAmountCents).toBe(5_815);
    expect(outcome.result.socialSecurityCreditAppliedCents).toBe(3_000);
  });
});

describe("calculateFloridaChildSupport — schedule edges and high income", () => {
  it("normalizes an intermediate combined income down to its table row (no interpolation)", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_499, overnightsWithChild: 320 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 249_500, overnightsWithChild: 45 }),
          ],
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.combinedNetMonthlyIncomeCents).toBe(499_999);
    expect(outcome.result.scheduleRowCombinedNetIncomeCents).toBe(495_000);
    expect(outcome.result.scheduleRowNormalizedFromRequestedIncome).toBe(true);
  });

  it("applies the above-$10,000 percentage formula for high combined income", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 525_000, overnightsWithChild: 320 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 525_000, overnightsWithChild: 45 }),
          ],
        }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.wasAboveSchedule).toBe(true);
    expect(outcome.result.combinedNetMonthlyIncomeCents).toBe(1_050_000);
    expect(outcome.result.basicMonthlyNeedCents).toBe(146_200);
  });
});

describe("calculateFloridaChildSupport — unsupported/invalid branches", () => {
  it("returns notImplemented when combined net income is below the $800 schedule minimum", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 30_000, overnightsWithChild: 320 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 30_000, overnightsWithChild: 45 }),
          ],
        }),
        "user-entered",
      ),
    );
    expect(outcome.kind).toBe("notImplemented");
  });

  it("returns notImplemented when the calculated obligor's net income is below $800", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 500_000, overnightsWithChild: 320 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 50_000, overnightsWithChild: 45 }),
          ],
        }),
        "user-entered",
      ),
    );
    expect(outcome.kind).toBe("notImplemented");
  });

  it("does not apply the low-income obligor branch when only the obligee is below $800", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 50_000, overnightsWithChild: 320 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 500_000, overnightsWithChild: 45 }),
          ],
        }),
        "user-entered",
      ),
    );
    expect(outcome.kind).toBe("calculated");
  });

  it("returns notImplemented for more than six children", () => {
    const outcome = calculateFloridaChildSupport(confirmFact(baseInput({ numberOfChildren: 7 }), "user-entered"));
    expect(outcome.kind).toBe("notImplemented");
  });

  it("returns needsInput for a negative gross income", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: -100, overnightsWithChild: 320 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 45 }),
          ],
        }),
        "user-entered",
      ),
    );
    expect(outcome.kind).toBe("needsInput");
  });

  it("returns needsInput for duplicate parentId values", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 320 }),
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 45 }),
          ],
        }),
        "user-entered",
      ),
    );
    expect(outcome.kind).toBe("needsInput");
  });

  it("returns needsInput when combined overnights exceed totalNightsInPeriod", () => {
    const outcome = calculateFloridaChildSupport(
      confirmFact(
        baseInput({
          parents: [
            baseParent({ parentId: "parent1", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 300 }),
            baseParent({ parentId: "parent2", monthlyGrossIncomeCents: 250_000, overnightsWithChild: 100 }),
          ],
        }),
        "user-entered",
      ),
    );
    expect(outcome.kind).toBe("needsInput");
  });

  it("rejects extraction-shaped (unconfirmed) data at the runtime boundary", () => {
    const extractionProposal = {
      value: baseInput(),
      confidence: 0.92,
      extractionSource: "document-ocr",
    };
    expect(() =>
      // @ts-expect-error intentionally passing a non-ConfirmedFact to prove the runtime guard rejects it
      calculateFloridaChildSupport(extractionProposal),
    ).toThrow(UnconfirmedInputError);
  });
});
