import { describe, expect, it } from "vitest";

import type { AlimonyResult } from "@/domain/rules/florida/alimony/types";
import type { EquitableDistributionResult } from "@/domain/rules/florida/equitableDistribution/types";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import { calculatedOutcome, type RuleOutcome } from "@/domain/rules/types";

import { buildPackageLumpSum } from "../lumpSum";

/**
 * These cases exist because the lump-sum term is the easiest place in the
 * app to accidentally invent a legal figure. The term must come only from a
 * durational alimony term the ruleset actually produced.
 */

function alimonyResult(overrides: {
  durationalAvailable: boolean;
  maxDurationMonths: number | null;
  rangeCeilingCents: number;
  marriageDurationMonths: number;
}): AlimonyResult {
  return {
    marriageDurationCategory: "long",
    marriageDurationMonths: overrides.marriageDurationMonths,
    marriageDurationDays: overrides.marriageDurationMonths * 30,
    formAvailability: [
      {
        form: "durational",
        available: overrides.durationalAvailable,
        reason: "test fixture",
        maxDurationMonths: overrides.maxDurationMonths,
      },
      { form: "bridgeTheGap", available: true, reason: "test fixture", maxDurationMonths: 24 },
    ],
    payorNetMonthlyIncomeCents: 800_000,
    obligeeNetMonthlyIncomeCents: 200_000,
    netIncomeDifferenceCents: 600_000,
    amountCeiling: {
      rangeFloorCents: 0,
      rangeCeilingCents: overrides.rangeCeilingCents,
      limitingFactor: "reasonableNeed",
      confirmedReasonableMonthlyNeedCents: overrides.rangeCeilingCents,
      thirtyFivePercentOfIncomeDifferenceCents: 210_000,
    },
    postScenarioCashFlowAtCeiling: {
      payorNetMonthlyIncomeBeforeCents: 800_000,
      obligeeNetMonthlyIncomeBeforeCents: 200_000,
      payorNetMonthlyIncomeAfterCents: 700_000,
      obligeeNetMonthlyIncomeAfterCents: 300_000,
    },
    subsectionThreeFactors: [],
  } as AlimonyResult;
}

function alimonyOutcome(result: AlimonyResult): RuleOutcome<AlimonyResult> {
  return calculatedOutcome({
    rulesetId: "fl-alimony-61.08",
    result,
    formulaTrace: [],
    citations: [],
    assumptions: [],
    warnings: [],
  });
}

const REVIEWED = {
  data: {
    spouses: { yourNameOrInitials: "A.B.", spouseNameOrInitials: "C.D." },
    alimonyFactors: { potentialAlimonyRecipient: "spouse" },
  },
} as unknown as ReviewedIntakeDraft;

const NO_ED: RuleOutcome<EquitableDistributionResult> = {
  kind: "needsInput",
  rulesetId: "fl-equitable-distribution-61.075",
  missingFacts: [],
  message: "test fixture",
};

describe("buildPackageLumpSum term selection", () => {
  it("models a buyout from a calculated durational term", () => {
    const lumpSum = buildPackageLumpSum(
      REVIEWED,
      alimonyOutcome(
        alimonyResult({
          durationalAvailable: true,
          maxDurationMonths: 90,
          rangeCeilingCents: 150_000,
          marriageDurationMonths: 300,
        }),
      ),
      NO_ED,
    );

    expect(lumpSum.available).toBe(true);
    expect(lumpSum.numberOfMonths).toBe(90);
    expect(lumpSum.model?.selected.presentValueCents).toBeGreaterThan(0);
  });

  it("refuses to model a buyout when durational alimony is unavailable", () => {
    // A 25-year marriage with no durational term must NOT borrow its 300
    // months: that would invent a term with no statutory basis.
    const lumpSum = buildPackageLumpSum(
      REVIEWED,
      alimonyOutcome(
        alimonyResult({
          durationalAvailable: false,
          maxDurationMonths: null,
          rangeCeilingCents: 150_000,
          marriageDurationMonths: 300,
        }),
      ),
      NO_ED,
    );

    expect(lumpSum.available).toBe(false);
    expect(lumpSum.numberOfMonths).toBe(0);
    expect(lumpSum.model).toBeNull();
    expect(lumpSum.reason).toContain("durational alimony term");
  });

  it("does not fall back to the marriage length for a short marriage", () => {
    const lumpSum = buildPackageLumpSum(
      REVIEWED,
      alimonyOutcome(
        alimonyResult({
          durationalAvailable: false,
          maxDurationMonths: null,
          rangeCeilingCents: 100_000,
          marriageDurationMonths: 30,
        }),
      ),
      NO_ED,
    );

    expect(lumpSum.available).toBe(false);
    expect(lumpSum.reason).toContain("less than 3 years");
  });

  it("refuses to model a buyout when the alimony ceiling is zero", () => {
    const lumpSum = buildPackageLumpSum(
      REVIEWED,
      alimonyOutcome(
        alimonyResult({
          durationalAvailable: true,
          maxDurationMonths: 60,
          rangeCeilingCents: 0,
          marriageDurationMonths: 240,
        }),
      ),
      NO_ED,
    );

    expect(lumpSum.available).toBe(false);
    expect(lumpSum.model).toBeNull();
  });

  it("does not model a buyout when alimony itself was not calculated", () => {
    const lumpSum = buildPackageLumpSum(
      REVIEWED,
      { kind: "needsInput", rulesetId: "fl-alimony-61.08", missingFacts: [], message: "test fixture" },
      NO_ED,
    );

    expect(lumpSum.available).toBe(false);
    expect(lumpSum.model).toBeNull();
  });
});
