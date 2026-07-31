/**
 * Fla. Stat. §61.08 alimony calculation.
 *
 * Returns a transparent 0-to-ceiling amount range and available forms with
 * their statutory duration caps — never a recommended court award. Pure
 * function; no AI/server imports.
 */
import {
  assertConfirmedFact,
  type ConfirmedFact,
  unwrapConfirmedFact,
} from "../../confirmedFact";
import { daysBetween, wholeMonthsBetween } from "../../dateMath";
import { addCents, basisPointsOfCents, cents, type Cents, clampToZero, minCents, subtractCents } from "../../money";
import {
  calculatedOutcome,
  needsInputOutcome,
  requiresProfessionalReviewOutcome,
  type FormulaStep,
  type RuleFlag,
  type RuleOutcome,
} from "../../types";
import {
  FLORIDA_ALIMONY_CURRENT_LAW_EFFECTIVE_DATE,
  FLORIDA_ALIMONY_STATUTE_CITATION,
} from "../metadata";
import {
  alimonyInputSchema,
  type AlimonyDeductions,
  type AlimonyFormAvailability,
  type AlimonyInput,
  type AlimonyResult,
  type MarriageDurationCategory,
} from "./types";

export const FLORIDA_ALIMONY_RULESET_ID = "fl-alimony-61.08";

const citation = FLORIDA_ALIMONY_STATUTE_CITATION;

const SHORT_TERM_MAX_MONTHS = 120; // < 10 years
const MODERATE_TERM_MAX_MONTHS = 240; // < 20 years
const DURATIONAL_MIN_MARRIAGE_MONTHS = 36; // 3 years
const BRIDGE_THE_GAP_MAX_MONTHS = 24;
const REHABILITATIVE_MAX_MONTHS = 60;
const DURATION_CEILING_RATIO: Record<MarriageDurationCategory, number> = {
  short: 0.5,
  moderate: 0.6,
  long: 0.75,
};
const DURATIONAL_AMOUNT_BASIS_POINTS = 3_500; // 35.00%

export const ALIMONY_SUBSECTION_THREE_FACTORS = [
  { factorId: "a", citation: "Fla. Stat. §61.08(3)(a)", description: "The duration of the marriage." },
  {
    factorId: "b",
    citation: "Fla. Stat. §61.08(3)(b)",
    description:
      "The standard of living established during the marriage and the anticipated needs and necessities of life for each party after the final judgment.",
  },
  {
    factorId: "c",
    citation: "Fla. Stat. §61.08(3)(c)",
    description:
      "The age, physical, mental, and emotional condition of each party, including any disability and its impact on need or ability to pay.",
  },
  {
    factorId: "d",
    citation: "Fla. Stat. §61.08(3)(d)",
    description: "The resources and income of each party, including income generated from nonmarital and marital assets.",
  },
  {
    factorId: "e",
    citation: "Fla. Stat. §61.08(3)(e)",
    description:
      "The earning capacities, educational levels, vocational skills, and employability of the parties, including the ability to become self-supporting.",
  },
  {
    factorId: "f",
    citation: "Fla. Stat. §61.08(3)(f)",
    description:
      "The contribution of each party to the marriage, including homemaking, child care, education, and career-building of the other party.",
  },
  {
    factorId: "g",
    citation: "Fla. Stat. §61.08(3)(g)",
    description: "The responsibilities each party will have regarding any minor children in common.",
  },
  {
    factorId: "h",
    citation: "Fla. Stat. §61.08(3)(h)",
    description: "Any other factor necessary for equity and justice between the parties.",
  },
] as const;

function sumDeductions(deductions: AlimonyDeductions): Cents {
  return addCents(
    cents(deductions.federalStateLocalIncomeTaxCents),
    cents(deductions.ficaOrSelfEmploymentTaxCents),
    cents(deductions.mandatoryRetirementCents),
    cents(deductions.healthInsurancePremiumSelfOnlyCents),
    cents(deductions.courtOrderedSupportForOtherChildrenPaidCents),
    cents(deductions.spousalSupportPaidUnderPriorOrderCents),
  );
}

function categorizeMarriageDuration(months: number): MarriageDurationCategory {
  if (months < SHORT_TERM_MAX_MONTHS) return "short";
  if (months < MODERATE_TERM_MAX_MONTHS) return "moderate";
  return "long";
}

export function calculateFloridaAlimony(
  input: ConfirmedFact<AlimonyInput>,
): RuleOutcome<AlimonyResult> {
  assertConfirmedFact<AlimonyInput>(input);
  const raw = unwrapConfirmedFact(input);

  const parsed = alimonyInputSchema.safeParse(raw);
  if (!parsed.success) {
    return needsInputOutcome({
      rulesetId: FLORIDA_ALIMONY_RULESET_ID,
      message: "One or more alimony inputs are missing or invalid.",
      missingFacts: parsed.error.issues.map((issue) => ({
        factId: issue.path.join(".") || "root",
        description: issue.message,
      })),
    });
  }
  const value = parsed.data;

  // Florida current-law selection: only petitions pending/filed on or after
  // 2023-07-01 are governed by this ruleset. Fla. Stat. §61.08(11).
  if (value.petitionFilingDateIso < FLORIDA_ALIMONY_CURRENT_LAW_EFFECTIVE_DATE) {
    return requiresProfessionalReviewOutcome({
      rulesetId: FLORIDA_ALIMONY_RULESET_ID,
      reason: `Fla. Stat. §61.08 in its current form applies only to petitions pending or filed on or after ${FLORIDA_ALIMONY_CURRENT_LAW_EFFECTIVE_DATE}. This petition's filing date (${value.petitionFilingDateIso}) precedes that date, so a materially different prior version of the alimony statute applies (which may include permanent alimony and different duration rules). This ruleset does not implement the prior law; professional review is required.`,
      flags: [
        {
          flagId: "priorLawAlimonyStatute",
          description: "Petition predates the 2023-07-01 current-law effective date.",
          severity: "blocking",
          citation: "Fla. Stat. §61.08(11)",
        },
      ],
      citations: [citation],
    });
  }

  // §61.08(2)(a): need and ability-to-pay are threshold determinations that
  // must be established before any amount/duration formula is relevant.
  if (value.needDisputed || value.abilityToPayDisputed) {
    const flags: RuleFlag[] = [];
    if (value.needDisputed) {
      flags.push({
        flagId: "needDisputed",
        description:
          "The obligee's actual need for alimony is disputed. The obligee bears the burden of proving need before any amount or duration is calculated.",
        severity: "blocking",
        citation: "Fla. Stat. §61.08(2)(a)",
      });
    }
    if (value.abilityToPayDisputed) {
      flags.push({
        flagId: "abilityToPayDisputed",
        description:
          "The payor's ability to pay alimony is disputed. The obligee bears the burden of proving the payor's ability to pay before any amount or duration is calculated.",
        severity: "blocking",
        citation: "Fla. Stat. §61.08(2)(a)",
      });
    }
    return requiresProfessionalReviewOutcome({
      rulesetId: FLORIDA_ALIMONY_RULESET_ID,
      reason:
        "Need and/or ability to pay is disputed. Florida law requires this threshold factual determination before any alimony amount or duration is considered; this ruleset does not resolve factual disputes and requires professional/judicial review.",
      flags,
      citations: [citation],
    });
  }

  const formulaTrace: FormulaStep[] = [];
  const warnings: RuleFlag[] = [];
  const assumptions: string[] = [
    "Marriage duration is measured in whole elapsed calendar months from the marriage date to the petition filing date (a trailing partial month is not counted).",
    "Durational alimony's duration ceiling is computed against the exact marriage length (in months, floored), not the short/moderate/long category's typical range.",
    "For bridge-the-gap and rehabilitative alimony, the reasonable-need/35%-of-income-difference figure is presented only as an illustrative ability-to-pay planning ceiling under §61.08(2)(a); the statutory percentage ceiling in §61.08(8)(c) applies explicitly only to durational alimony.",
  ];

  const marriageDurationDays = daysBetween(value.marriageDateIso, value.petitionFilingDateIso);
  const marriageDurationMonths = wholeMonthsBetween(value.marriageDateIso, value.petitionFilingDateIso);
  const category = categorizeMarriageDuration(marriageDurationMonths);
  formulaTrace.push({
    stepId: "marriage-duration",
    description: "Marriage duration measured from marriage date to petition filing date.",
    citation: "Fla. Stat. §61.08(5)",
    values: {
      marriageDateIso: value.marriageDateIso,
      petitionFilingDateIso: value.petitionFilingDateIso,
      marriageDurationDays,
      marriageDurationMonths,
      category,
    },
  });

  const formAvailability: AlimonyFormAvailability[] = [];

  formAvailability.push({
    form: "bridgeTheGap",
    available: true,
    reason:
      "Available (subject to proof of a legitimate identifiable short-term need); not modifiable in amount or duration; terminates on death or the obligee's remarriage.",
    maxDurationMonths: BRIDGE_THE_GAP_MAX_MONTHS,
  });

  formAvailability.push({
    form: "rehabilitative",
    available: value.rehabilitativePlanConfirmed,
    reason: value.rehabilitativePlanConfirmed
      ? "Available; a specific, defined rehabilitative plan is on record as required by §61.08(7)(b)."
      : "Not available: Fla. Stat. §61.08(7)(b) requires a specific, defined rehabilitative plan to be part of any award, and none is confirmed.",
    maxDurationMonths: REHABILITATIVE_MAX_MONTHS,
  });

  const durationalAvailable = marriageDurationMonths >= DURATIONAL_MIN_MARRIAGE_MONTHS;
  const durationalCeilingMonths = durationalAvailable
    ? Math.floor(marriageDurationMonths * DURATION_CEILING_RATIO[category])
    : null;
  formAvailability.push({
    form: "durational",
    available: durationalAvailable,
    reason: durationalAvailable
      ? `Available; may not exceed ${Math.round(DURATION_CEILING_RATIO[category] * 100)}% of the ${category}-term marriage's length (${durationalCeilingMonths} months), absent exceptional circumstances.`
      : "Not available: durational alimony may not be awarded following a marriage lasting less than 3 years.",
    maxDurationMonths: durationalCeilingMonths,
  });
  formulaTrace.push({
    stepId: "form-availability",
    description: "Available alimony forms and their statutory duration ceilings.",
    citation: "Fla. Stat. §61.08(6)-(8)",
    values: {
      bridgeTheGapMaxMonths: BRIDGE_THE_GAP_MAX_MONTHS,
      rehabilitativeMaxMonths: REHABILITATIVE_MAX_MONTHS,
      durationalAvailable,
      durationalCeilingMonths,
    },
  });

  if (value.exceptionalCircumstancesExtensionRequested) {
    warnings.push({
      flagId: "exceptionalCircumstancesExtensionRequested",
      description:
        "An extension of durational alimony beyond the statutory ceiling was requested. This requires clear and convincing evidence and specific written findings under §61.08(8)(b); it is not computed by this ruleset and the reported duration ceiling does not reflect any such extension.",
      severity: "warning",
      citation: "Fla. Stat. §61.08(8)(b)",
    });
  }

  const payorNetCents = clampToZero(
    subtractCents(cents(value.payor.monthlyGrossIncomeCents), sumDeductions(value.payor.deductions)),
  );
  const obligeeNetCents = clampToZero(
    subtractCents(cents(value.obligee.monthlyGrossIncomeCents), sumDeductions(value.obligee.deductions)),
  );
  formulaTrace.push({
    stepId: "net-incomes",
    description: "Net income for each party, computed per Fla. Stat. §61.30(2)-(3), excluding support paid in this action.",
    citation: "Fla. Stat. §61.08(8)(c)",
    values: { payorNetMonthlyIncomeCents: payorNetCents, obligeeNetMonthlyIncomeCents: obligeeNetCents },
  });

  const rawIncomeDifference = subtractCents(payorNetCents, obligeeNetCents);
  const netIncomeDifferenceCents = clampToZero(rawIncomeDifference);
  if (rawIncomeDifference <= 0) {
    warnings.push({
      flagId: "obligeeIncomeMeetsOrExceedsPayorIncome",
      description:
        "The obligee's net monthly income meets or exceeds the payor's, so the 35%-of-income-difference ceiling is $0.00. This does not by itself resolve need or ability to pay, which remain separate threshold determinations.",
      severity: "warning",
      citation: "Fla. Stat. §61.08(8)(c)",
    });
  }

  const reasonableNeedCents = cents(value.confirmedReasonableMonthlyNeedCents);
  const thirtyFivePercentCents = basisPointsOfCents(netIncomeDifferenceCents, DURATIONAL_AMOUNT_BASIS_POINTS);
  const rangeCeilingCents = minCents(reasonableNeedCents, thirtyFivePercentCents);
  const limitingFactor: "reasonableNeed" | "thirtyFivePercentIncomeDifference" =
    reasonableNeedCents <= thirtyFivePercentCents ? "reasonableNeed" : "thirtyFivePercentIncomeDifference";

  if (reasonableNeedCents === 0) {
    warnings.push({
      flagId: "zeroReasonableNeed",
      description:
        "The recipient's reasonable monthly need is $0.00, which forces the amount ceiling to $0.00 regardless of " +
        "either party's income. Under §61.08(2)(a) need is a threshold element, so no alimony amount can be " +
        "supported until a documented monthly need is established.",
      severity: "warning",
      citation: "Fla. Stat. §61.08(2)(a)",
    });
  }

  if (rangeCeilingCents === 0) {
    warnings.push({
      flagId: "zeroAmountCeiling",
      description:
        "The estimated amount range is $0.00 because at least one of the two statutory limits is $0.00: the " +
        `recipient's reasonable monthly need and 35% of the parties' net-income difference. Need is currently ` +
        `${reasonableNeedCents === 0 ? "$0.00" : "greater than $0.00"} and the 35% figure is currently ` +
        `${thirtyFivePercentCents === 0 ? "$0.00" : "greater than $0.00"}. The ceiling is always the lesser of the ` +
        "two, so raising only the larger one will not change this result.",
      severity: "warning",
      citation: "Fla. Stat. §61.08(8)(c)",
    });
  }

  formulaTrace.push({
    stepId: "amount-ceiling",
    description:
      "Amount ceiling is the lesser of the confirmed reasonable need and 35% of the difference between the parties' net incomes.",
    citation: "Fla. Stat. §61.08(8)(c)",
    values: {
      confirmedReasonableMonthlyNeedCents: reasonableNeedCents,
      netIncomeDifferenceCents,
      thirtyFivePercentOfIncomeDifferenceCents: thirtyFivePercentCents,
      rangeCeilingCents,
      limitingFactor,
    },
  });

  const payorNetAfterCents = subtractCents(payorNetCents, rangeCeilingCents);
  const obligeeNetAfterCents = addCents(obligeeNetCents, rangeCeilingCents);
  formulaTrace.push({
    stepId: "post-scenario-cash-flow",
    description: "Illustrative post-transfer net income for each party AT THE CEILING amount; not a recommended award.",
    citation: "Fla. Stat. §61.08(9)",
    values: {
      payorNetMonthlyIncomeAfterCents: payorNetAfterCents,
      obligeeNetMonthlyIncomeAfterCents: obligeeNetAfterCents,
    },
  });

  if (payorNetAfterCents < obligeeNetAfterCents) {
    warnings.push({
      flagId: "significantlyLessNetIncome",
      description:
        "At the illustrative ceiling amount, the payor would be left with less net income than the obligee. §61.08(9) prohibits leaving the payor with significantly less net income than the obligee absent written findings of exceptional circumstances.",
      severity: "warning",
      citation: "Fla. Stat. §61.08(9)",
    });
  }

  const result: AlimonyResult = {
    marriageDurationCategory: category,
    marriageDurationMonths,
    marriageDurationDays,
    formAvailability,
    payorNetMonthlyIncomeCents: payorNetCents,
    obligeeNetMonthlyIncomeCents: obligeeNetCents,
    netIncomeDifferenceCents,
    amountCeiling: {
      rangeFloorCents: 0,
      rangeCeilingCents,
      limitingFactor,
      confirmedReasonableMonthlyNeedCents: reasonableNeedCents,
      thirtyFivePercentOfIncomeDifferenceCents: thirtyFivePercentCents,
    },
    postScenarioCashFlowAtCeiling: {
      payorNetMonthlyIncomeBeforeCents: payorNetCents,
      obligeeNetMonthlyIncomeBeforeCents: obligeeNetCents,
      payorNetMonthlyIncomeAfterCents: payorNetAfterCents,
      obligeeNetMonthlyIncomeAfterCents: obligeeNetAfterCents,
    },
    subsectionThreeFactors: ALIMONY_SUBSECTION_THREE_FACTORS,
  };

  return calculatedOutcome({
    rulesetId: FLORIDA_ALIMONY_RULESET_ID,
    result,
    formulaTrace,
    citations: [citation],
    assumptions,
    warnings,
  });
}
