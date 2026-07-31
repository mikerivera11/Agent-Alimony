import { modelLumpSum, type LumpSumModel } from "@/domain/finance";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import { cents } from "@/domain/rules";
import type { AlimonyResult, EquitableDistributionResult, RuleOutcome } from "@/domain/rules";

import type { PackageLumpSum } from "./types";

/**
 * A single, deliberately arbitrary discount rate (5.00% per year) used ONLY to
 * produce a printable present-value figure and to seed the sensitivity band.
 * No Florida statute fixes a rate — §61.075(10)(b) merely lets a court require
 * "a reasonable rate of interest" — so this is presented as an illustration,
 * never as a legal standard, and the interactive results screen lets the user
 * substitute their own assumption.
 */
export const PACKAGE_LUMP_SUM_ILLUSTRATIVE_RATE_BPS = 500;

/**
 * The lump-sum term comes only from a durational alimony term the ruleset
 * actually calculated. There is deliberately no fallback: if durational
 * alimony is unavailable, substituting the marriage length would invent a
 * support term with no statutory basis, and would do so most badly in
 * exactly the cases that matter. A marriage under 3 years cannot support
 * durational alimony at all under §61.08(8)(a), and bridge-the-gap is capped
 * at 2 years under §61.08(6)(c) while rehabilitative is capped at 5 under
 * §61.08(7)(d) — so a long marriage's length would inflate the buyout far
 * beyond anything the statute permits. Showing nothing is correct here.
 */
function selectDurationalMonths(alimony: AlimonyResult): number {
  const durational = alimony.formAvailability.find((form) => form.form === "durational" && form.available);
  return durational?.maxDurationMonths && durational.maxDurationMonths > 0 ? durational.maxDurationMonths : 0;
}

/**
 * Builds the lump-sum settlement inputs and an illustrative present-value model
 * from whatever alimony and equitable-distribution outcomes were actually
 * calculated. Pure; never invents an alimony figure that was not computed.
 */
export function buildPackageLumpSum(
  reviewed: ReviewedIntakeDraft,
  alimony: RuleOutcome<AlimonyResult>,
  equitableDistribution: RuleOutcome<EquitableDistributionResult>,
): PackageLumpSum {
  const partyALabel = reviewed.data.spouses.yourNameOrInitials;
  const partyBLabel = reviewed.data.spouses.spouseNameOrInitials;

  const recipient = reviewed.data.alimonyFactors.potentialAlimonyRecipient;
  // Party A is "you" in the equitable-distribution mapper; the alimony payor is
  // therefore the OTHER spouse from the selected recipient.
  const alimonyPayorSpouse: "a" | "b" | null =
    recipient === "self" ? "b" : recipient === "spouse" ? "a" : null;

  const equalizing =
    equitableDistribution.kind === "calculated"
      ? equitableDistribution.result.distributionWithExclusions.equalizingPayment
      : null;
  const equalizingPaymentCents = equalizing?.amountCents ?? 0;
  const equalizingFromSpouse = equalizing?.fromSpouse ?? null;

  if (alimony.kind !== "calculated") {
    return {
      available: false,
      reason:
        "A lump-sum alimony buyout is only modeled once a periodic alimony estimate has been calculated. " +
        "Complete the alimony inputs (including a chosen recipient) to see a lump-sum option.",
      monthlyAmountCents: 0,
      numberOfMonths: 0,
      illustrativeRateBps: PACKAGE_LUMP_SUM_ILLUSTRATIVE_RATE_BPS,
      model: null,
      equalizingPaymentCents,
      equalizingFromSpouse,
      alimonyPayorSpouse,
      partyALabel,
      partyBLabel,
    };
  }

  const monthlyAmountCents = alimony.result.amountCeiling.rangeCeilingCents;
  const numberOfMonths = selectDurationalMonths(alimony.result);

  if (monthlyAmountCents <= 0 || numberOfMonths <= 0) {
    return {
      available: false,
      reason:
        numberOfMonths <= 0
          ? "A lump-sum buyout is modeled only from a durational alimony term. This case does not have one — " +
            "durational alimony is not available for a marriage of less than 3 years, and bridge-the-gap and " +
            "rehabilitative alimony are tied to specific short-term needs or a written plan rather than to a " +
            "fixed term. Substituting the length of the marriage would invent a term Florida law does not " +
            "support, so no present-value figure is shown."
          : "There is no positive periodic alimony amount to convert into a lump sum, so no present-value " +
            "model is shown.",
      monthlyAmountCents,
      numberOfMonths,
      illustrativeRateBps: PACKAGE_LUMP_SUM_ILLUSTRATIVE_RATE_BPS,
      model: null,
      equalizingPaymentCents,
      equalizingFromSpouse,
      alimonyPayorSpouse,
      partyALabel,
      partyBLabel,
    };
  }

  const model: LumpSumModel = modelLumpSum({
    monthlyAmountCents: cents(monthlyAmountCents),
    numberOfMonths,
    annualDiscountRateBps: PACKAGE_LUMP_SUM_ILLUSTRATIVE_RATE_BPS,
  });

  return {
    available: true,
    reason: null,
    monthlyAmountCents,
    numberOfMonths,
    illustrativeRateBps: PACKAGE_LUMP_SUM_ILLUSTRATIVE_RATE_BPS,
    model,
    equalizingPaymentCents,
    equalizingFromSpouse,
    alimonyPayorSpouse,
    partyALabel,
    partyBLabel,
  };
}
