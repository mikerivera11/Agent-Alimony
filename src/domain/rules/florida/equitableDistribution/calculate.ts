/**
 * Fla. Stat. §61.075 equitable distribution of marital assets and liabilities.
 *
 * Sets apart each spouse's nonmarital property, totals the marital estate, and
 * — beginning from the statutory premise that the distribution should be EQUAL
 * (§61.075(1)) — computes the equalizing payment needed to reach a 50/50 split.
 * It reports the distribution BOTH with and without any written-agreement
 * exclusions so the effect of each exclusion is transparent.
 *
 * It never predicts an unequal distribution (there is no statutory formula for
 * one), never scores the §61.075(1) factors, and returns a typed
 * requiresProfessionalReview outcome for the branches it deliberately does not
 * implement. Pure function; no AI/server imports; all money in integer cents.
 */
import {
  assertConfirmedFact,
  type ConfirmedFact,
  unwrapConfirmedFact,
} from "../../confirmedFact";
import {
  addCents,
  allocateProportionally,
  cents,
  type Cents,
  roundHalfUp,
  subtractCents,
  ZERO_CENTS,
} from "../../money";
import {
  calculatedOutcome,
  needsInputOutcome,
  requiresProfessionalReviewOutcome,
  type FormulaStep,
  type RuleFlag,
  type RuleOutcome,
  type StatutoryCitation,
} from "../../types";
import { FLORIDA_EQUITABLE_DISTRIBUTION_STATUTE_CITATION } from "../metadata";
import {
  ED_NONMARITAL_BASIS_CITATIONS,
  equitableDistributionInputSchema,
  type DistributionScenario,
  type EdSpouse,
  type EquitableDistributionInput,
  type EquitableDistributionItem,
  type EquitableDistributionResult,
  type ExcludedItemEffect,
  type NonmaritalSetAside,
  type SetAsideItem,
  type UnequalDistributionFactor,
} from "./types";

export const FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID = "fl-equitable-distribution-61.075";

const citation = FLORIDA_EQUITABLE_DISTRIBUTION_STATUTE_CITATION;

/**
 * The §61.075(1)(a)-(j) factors a court may consider to justify an unequal
 * distribution. Returned as structured display data only — this ruleset never
 * scores, weights, or predicts how a judge would apply them.
 */
export const EQUITABLE_DISTRIBUTION_FACTORS: readonly UnequalDistributionFactor[] = [
  {
    factorId: "a",
    citation: "Fla. Stat. §61.075(1)(a)",
    description:
      "The contribution to the marriage by each spouse, including contributions to the care and education of the children and services as a homemaker.",
  },
  {
    factorId: "b",
    citation: "Fla. Stat. §61.075(1)(b)",
    description: "The economic circumstances of the parties.",
  },
  {
    factorId: "c",
    citation: "Fla. Stat. §61.075(1)(c)",
    description: "The duration of the marriage.",
  },
  {
    factorId: "d",
    citation: "Fla. Stat. §61.075(1)(d)",
    description: "Any interruption of personal careers or educational opportunities of either party.",
  },
  {
    factorId: "e",
    citation: "Fla. Stat. §61.075(1)(e)",
    description:
      "The contribution of one spouse to the personal career or educational opportunity of the other spouse.",
  },
  {
    factorId: "f",
    citation: "Fla. Stat. §61.075(1)(f)",
    description:
      "The desirability of retaining any asset, including an interest in a business, corporation, or professional practice, intact and free from any claim or interference by the other party.",
  },
  {
    factorId: "g",
    citation: "Fla. Stat. §61.075(1)(g)",
    description:
      "The contribution of each spouse to the acquisition, enhancement, and production of income or the improvement of, or the incurring of liabilities to, both the marital assets and the nonmarital assets of the parties.",
  },
  {
    factorId: "h",
    citation: "Fla. Stat. §61.075(1)(h)",
    description:
      "The desirability of retaining the marital home as a residence for any dependent child of the marriage, when it would be equitable to do so.",
  },
  {
    factorId: "i",
    citation: "Fla. Stat. §61.075(1)(i)",
    description:
      "The intentional dissipation, waste, depletion, or destruction of marital assets after the filing of the petition or within 2 years prior to the filing of the petition.",
  },
  {
    factorId: "j",
    citation: "Fla. Stat. §61.075(1)(j)",
    description: "Any other factors necessary to do equity and justice between the parties.",
  },
] as const;

function isMaritalEstateItem(item: EquitableDistributionItem): boolean {
  return item.classification === "marital" || item.classification === "presumedMarital";
}

/** True when the item is flagged for §61.075(6)(b)4 written-agreement exclusion. */
function isExclusionCandidate(item: EquitableDistributionItem): boolean {
  return item.excludedByWrittenAgreement === true;
}

/**
 * Splits a non-negative cent value 50/50 with no drift. A single leftover cent
 * (odd value) is deterministically attributed to Spouse A.
 */
function splitEvenly(valueCents: Cents): [Cents, Cents] {
  const [a, b] = allocateProportionally(valueCents, [1, 1]);
  return [a, b];
}

/** Computes a full 50/50 distribution over the supplied marital items. */
function computeScenario(maritalItems: readonly EquitableDistributionItem[]): DistributionScenario {
  let assets = ZERO_CENTS;
  let liabilities = ZERO_CENTS;
  let holdingA = 0;
  let holdingB = 0;

  for (const item of maritalItems) {
    const value = cents(item.valueCents);
    const sign = item.type === "asset" ? 1 : -1;
    if (item.type === "asset") {
      assets = addCents(assets, value);
    } else {
      liabilities = addCents(liabilities, value);
    }

    if (item.owner === "a") {
      holdingA += sign * value;
    } else if (item.owner === "b") {
      holdingB += sign * value;
    } else {
      const [halfA, halfB] = splitEvenly(value);
      holdingA += sign * halfA;
      holdingB += sign * halfB;
    }
  }

  const net = subtractCents(assets, liabilities);
  const targetA = roundHalfUp(net / 2);
  const targetB = net - targetA;

  // Positive => Spouse A currently holds more than the equal target and must
  // transfer the difference to Spouse B; negative => the reverse.
  const paymentByA = holdingA - targetA;
  let fromSpouse: EdSpouse | null = null;
  let toSpouse: EdSpouse | null = null;
  let amount = 0;
  if (paymentByA > 0) {
    fromSpouse = "a";
    toSpouse = "b";
    amount = paymentByA;
  } else if (paymentByA < 0) {
    fromSpouse = "b";
    toSpouse = "a";
    amount = -paymentByA;
  }

  return {
    maritalAssetsCents: assets,
    maritalLiabilitiesCents: liabilities,
    netMaritalEstateCents: net,
    targetShareACents: cents(targetA),
    targetShareBCents: cents(targetB),
    holdingACents: cents(holdingA),
    holdingBCents: cents(holdingB),
    equalizingPayment: { fromSpouse, toSpouse, amountCents: cents(amount) },
    negativeEstate: net < 0,
  };
}

function summarizeNonmarital(items: readonly EquitableDistributionItem[]): NonmaritalSetAside {
  const setAsideItems: SetAsideItem[] = [];
  let aAssets = 0;
  let aLiabilities = 0;
  let bAssets = 0;
  let bLiabilities = 0;

  for (const item of items) {
    if (item.classification !== "nonmarital" || item.nonmaritalBasis === undefined) continue;
    setAsideItems.push({
      id: item.id,
      label: item.label,
      category: item.category,
      type: item.type,
      valueCents: item.valueCents,
      owner: item.owner,
      basis: item.nonmaritalBasis,
      basisCitation: ED_NONMARITAL_BASIS_CITATIONS[item.nonmaritalBasis],
    });

    // A jointly-owned nonmarital item (unusual) is split evenly so per-spouse
    // set-aside totals still reconcile.
    const value = cents(item.valueCents);
    const [halfA, halfB] = item.owner === "joint" ? splitEvenly(value) : [value, ZERO_CENTS];
    const forA = item.owner === "a" ? value : item.owner === "joint" ? halfA : ZERO_CENTS;
    const forB = item.owner === "b" ? value : item.owner === "joint" ? halfB : ZERO_CENTS;
    if (item.type === "asset") {
      aAssets += forA;
      bAssets += forB;
    } else {
      aLiabilities += forA;
      bLiabilities += forB;
    }
  }

  return {
    items: setAsideItems,
    aAssetsCents: cents(aAssets),
    aLiabilitiesCents: cents(aLiabilities),
    aNetCents: subtractCents(cents(aAssets), cents(aLiabilities)),
    bAssetsCents: cents(bAssets),
    bLiabilitiesCents: cents(bLiabilities),
    bNetCents: subtractCents(cents(bAssets), cents(bLiabilities)),
  };
}

export function calculateFloridaEquitableDistribution(
  input: ConfirmedFact<EquitableDistributionInput>,
): RuleOutcome<EquitableDistributionResult> {
  assertConfirmedFact<EquitableDistributionInput>(input);
  const raw = unwrapConfirmedFact(input);

  const parsed = equitableDistributionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return needsInputOutcome({
      rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
      message: "One or more equitable-distribution inputs are missing or invalid.",
      missingFacts: parsed.error.issues.map((issue) => ({
        factId: issue.path.join(".") || "root",
        description: issue.message,
      })),
    });
  }
  const value = parsed.data;

  // --- Deliberately-unimplemented branches (return typed professional review) ---

  const disputedItems = value.items.filter((item) => item.classification === "disputed");
  if (disputedItems.length > 0) {
    return requiresProfessionalReviewOutcome({
      rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
      reason:
        "One or more items have a disputed marital/nonmarital classification. Classifying contested property is a fact-intensive judicial determination under Fla. Stat. §61.075(6)-(8) that this ruleset does not resolve; the marital estate cannot be totaled until each item is classified.",
      flags: disputedItems.map((item) => ({
        flagId: `disputedClassification.${item.id}`,
        description: `"${item.label}" has a disputed classification and must be resolved before distribution.`,
        severity: "blocking" as const,
        citation: "Fla. Stat. §61.075(6)",
      })),
      citations: [citation],
    });
  }

  const commingledItems = value.items.filter(
    (item) => item.classification === "nonmarital" && item.commingledWithMaritalFunds,
  );
  if (commingledItems.length > 0) {
    return requiresProfessionalReviewOutcome({
      rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
      reason:
        "Separate (nonmarital) property was mixed with marital money or marital effort. Separate property keeps its character only so far as it can still be traced through the account history, and any enhancement in its value resulting from marital funds or either party's efforts during the marriage is itself marital under Fla. Stat. §61.075(6)(a)1.b. Tracing is an evidentiary exercise over statements this tool has not seen, so setting the whole amount aside — or refusing to — would both risk a materially wrong estate.",
      flags: commingledItems.map((item) => ({
        flagId: `tracingRequired.${item.id}`,
        description: `"${item.label}" is claimed as separate property but was mixed with marital funds or effort. How much remains separate depends on tracing, which a Florida family-law attorney or forensic accountant should do.`,
        severity: "blocking" as const,
        citation: "Fla. Stat. §61.075(6)(a)1.b",
      })),
      citations: [citation],
    });
  }

  const maritalBusinessItems = value.items.filter(
    (item) => item.category === "business" && isMaritalEstateItem(item) && !isExclusionCandidate(item),
  );
  if (maritalBusinessItems.length > 0) {
    return requiresProfessionalReviewOutcome({
      rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
      reason:
        "A closely held business interest is part of the marital estate. Valuing a closely held business at fair market value and characterizing enterprise versus personal goodwill under Fla. Stat. §61.075(6)(a)1.f is a professional valuation determination this ruleset does not implement; accepting a bare value would risk a materially wrong estate total.",
      flags: maritalBusinessItems.map((item) => ({
        flagId: `businessValuationRequired.${item.id}`,
        description: `"${item.label}" is a closely held business interest requiring professional valuation (fair market value; enterprise goodwill is marital).`,
        severity: "blocking" as const,
        citation: "Fla. Stat. §61.075(6)(a)1.f",
      })),
      citations: [citation],
    });
  }

  if (value.unequalDistributionRequested) {
    return requiresProfessionalReviewOutcome({
      rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
      reason:
        "An unequal distribution was requested. Fla. Stat. §61.075(1) sets EQUAL distribution as the premise and provides no formula for deviation — any unequal split is committed to judicial discretion on the (a)-(j) factors. This ruleset only computes the equal baseline and surfaces the factors for consideration; it does not predict a percentage of deviation.",
      flags: [
        {
          flagId: "unequalDistributionRequested",
          description: "Deviation from the equal-distribution premise requires judicial findings on the §61.075(1) factors.",
          severity: "blocking",
          citation: "Fla. Stat. §61.075(1)",
        },
      ],
      citations: [citation],
    });
  }

  if (value.dissipationClaimPresent) {
    return requiresProfessionalReviewOutcome({
      rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
      reason:
        "A claim of intentional dissipation, waste, depletion, or destruction of marital assets under Fla. Stat. §61.075(1)(i) is present. Whether dissipation occurred and any resulting offset are fact-intensive judicial findings this ruleset does not compute.",
      flags: [
        {
          flagId: "dissipationClaimPresent",
          description: "A dissipation claim requires judicial findings and is not offset by this ruleset.",
          severity: "blocking",
          citation: "Fla. Stat. §61.075(1)(i)",
        },
      ],
      citations: [citation],
    });
  }

  if (value.nonmaritalMortgagePaydownClaimPresent) {
    return requiresProfessionalReviewOutcome({
      rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
      reason:
        "A claim that marital funds or effort paid down principal on a note/mortgage secured by NONMARITAL real property is present. The Fla. Stat. §61.075(6)(a)1.c calculation — the paid-down principal plus a coverture-fraction share of passive appreciation — is an intricate, error-prone formula this ruleset deliberately does not implement.",
      flags: [
        {
          flagId: "nonmaritalMortgagePaydownClaimPresent",
          description: "The §61.075(6)(a)1.c coverture-fraction passive-appreciation calculation is not implemented.",
          severity: "blocking",
          citation: "Fla. Stat. §61.075(6)(a)1.c",
        },
      ],
      citations: [citation],
    });
  }

  // --- Calculated outcome ---

  const formulaTrace: FormulaStep[] = [];
  const warnings: RuleFlag[] = [];
  const citations: StatutoryCitation[] = [citation];
  const assumptions: string[] = [
    "Distribution begins from the statutory premise of an EQUAL (50/50) split of the net marital estate under §61.075(1); this tool never predicts an unequal distribution.",
    "Nonmarital assets and liabilities are set apart to their owner under §61.075(6)(b) and are not part of the equalizing calculation.",
    "Liabilities are entered as their own item type with a positive magnitude and reduce the marital estate; they are never modeled as negative assets.",
    "Jointly held/assigned items are treated as held 50/50 when computing each spouse's current holdings; if a joint item is an odd number of cents the extra cent is attributed to Spouse A deterministically.",
    "Item values are taken as already confirmed as of the §61.075(7) classification cut-off date (the earliest of a valid separation agreement date, a date set by that agreement, or the petition filing date); this tool neither values assets nor determines that date.",
    "Equitable distribution is determined first; only afterward is alimony considered (§61.075(9)). This ruleset computes distribution alone.",
  ];

  const nonmaritalSetAside = summarizeNonmarital(value.items);
  formulaTrace.push({
    stepId: "set-aside-nonmarital",
    description: "Nonmarital assets and liabilities are set apart to their owner and excluded from the marital estate.",
    citation: "Fla. Stat. §61.075(1), (6)(b)",
    values: {
      nonmaritalItemCount: nonmaritalSetAside.items.length,
      spouseANetSetAsideCents: nonmaritalSetAside.aNetCents,
      spouseBNetSetAsideCents: nonmaritalSetAside.bNetCents,
    },
  });

  // Baseline estate: every marital / presumed-marital item, ignoring any
  // written-agreement exclusion. §61.075(8) presumes post-marriage property
  // marital.
  const baselineItems = value.items.filter(isMaritalEstateItem);

  // Validly-excluded items are removed only when a written agreement is
  // confirmed. §61.075(6)(b)4.
  const exclusionCandidates = baselineItems.filter(isExclusionCandidate);
  const honoredExclusionIds = new Set<string>(
    value.writtenAgreementConfirmed ? exclusionCandidates.map((item) => item.id) : [],
  );
  const withExclusionItems = baselineItems.filter((item) => !honoredExclusionIds.has(item.id));

  const baselineWithoutExclusions = computeScenario(baselineItems);
  const distributionWithExclusions = computeScenario(withExclusionItems);

  formulaTrace.push({
    stepId: "baseline-without-exclusions",
    description: "Net marital estate and equalizing payment BEFORE applying any written-agreement exclusion.",
    citation: "Fla. Stat. §61.075(1), (8)",
    values: {
      maritalAssetsCents: baselineWithoutExclusions.maritalAssetsCents,
      maritalLiabilitiesCents: baselineWithoutExclusions.maritalLiabilitiesCents,
      netMaritalEstateCents: baselineWithoutExclusions.netMaritalEstateCents,
      equalizingFrom: baselineWithoutExclusions.equalizingPayment.fromSpouse,
      equalizingAmountCents: baselineWithoutExclusions.equalizingPayment.amountCents,
    },
  });
  formulaTrace.push({
    stepId: "distribution-with-exclusions",
    description: "Net marital estate and equalizing payment AFTER removing validly excluded items.",
    citation: "Fla. Stat. §61.075(1), (6)(b)4",
    values: {
      honoredExclusionCount: honoredExclusionIds.size,
      maritalAssetsCents: distributionWithExclusions.maritalAssetsCents,
      maritalLiabilitiesCents: distributionWithExclusions.maritalLiabilitiesCents,
      netMaritalEstateCents: distributionWithExclusions.netMaritalEstateCents,
      equalizingFrom: distributionWithExclusions.equalizingPayment.fromSpouse,
      equalizingAmountCents: distributionWithExclusions.equalizingPayment.amountCents,
    },
  });

  const exclusions: ExcludedItemEffect[] = exclusionCandidates.map((item) => {
    const honored = honoredExclusionIds.has(item.id);
    return {
      id: item.id,
      label: item.label,
      category: item.category,
      type: item.type,
      valueCents: item.valueCents,
      owner: item.owner,
      honored,
      reason: honored
        ? "Excluded from the marital estate under a confirmed valid written agreement (§61.075(6)(b)4)."
        : "NOT excluded: no valid written agreement is confirmed. §61.075(6)(b)4 requires a valid written agreement of the parties, so this item remains in the marital estate.",
    };
  });

  // Blocking flag for any exclusion asserted without a confirmed agreement.
  if (!value.writtenAgreementConfirmed) {
    for (const item of exclusionCandidates) {
      warnings.push({
        flagId: `writtenAgreementRequired.${item.id}`,
        description: `"${item.label}" is flagged as excluded by written agreement, but no valid written agreement is confirmed. Under §61.075(6)(b)4 a written agreement of the parties is required; this item was kept in the marital estate.`,
        severity: "blocking",
        citation: "Fla. Stat. §61.075(6)(b)4",
      });
    }
  }

  // Retirement/pension exclusion warning: benefits accrued during the marriage
  // are marital under §61.075(6)(a)1.e, and dividing a qualified plan generally
  // requires a separate court order (a QDRO).
  for (const item of exclusionCandidates) {
    if (item.category === "retirementAccount" && honoredExclusionIds.has(item.id)) {
      warnings.push({
        flagId: `retirementExclusion.${item.id}`,
        description: `"${item.label}" is a retirement/pension asset excluded by written agreement. Note that benefits accrued during the marriage are marital under §61.075(6)(a)1.e, and dividing a qualified retirement plan generally requires a separate court order (a QDRO). This ruleset does not determine QDRO specifics.`,
        severity: "warning",
        citation: "Fla. Stat. §61.075(6)(a)1.e",
      });
    }
  }

  if (distributionWithExclusions.negativeEstate) {
    warnings.push({
      flagId: "negativeMaritalEstate",
      description:
        "The net marital estate is negative (marital liabilities exceed marital assets). The equal-distribution premise applies to the net DEBT: the equalizing payment shifts liability so each spouse bears an equal net share.",
      severity: "warning",
      citation: "Fla. Stat. §61.075(1)",
    });
  }

  if (baselineItems.length === 0) {
    warnings.push({
      flagId: "noMaritalEstate",
      description:
        "No marital or presumed-marital items were provided, so the net marital estate is $0.00 and no equalizing payment is required. Only nonmarital property (if any) was set apart.",
      severity: "info",
      citation: "Fla. Stat. §61.075(1)",
    });
  }

  if (honoredExclusionIds.size > 0) {
    const delta = subtractCents(
      cents(distributionWithExclusions.equalizingPayment.amountCents),
      cents(baselineWithoutExclusions.equalizingPayment.amountCents),
    );
    formulaTrace.push({
      stepId: "exclusion-effect",
      description: "Effect of honored written-agreement exclusions on the equalizing payment (with minus without).",
      citation: "Fla. Stat. §61.075(6)(b)4",
      values: {
        baselineEqualizingAmountCents: baselineWithoutExclusions.equalizingPayment.amountCents,
        withExclusionsEqualizingAmountCents: distributionWithExclusions.equalizingPayment.amountCents,
        equalizingAmountDeltaCents: delta,
      },
    });
  }

  const result: EquitableDistributionResult = {
    partyALabel: value.partyALabel,
    partyBLabel: value.partyBLabel,
    writtenAgreementConfirmed: value.writtenAgreementConfirmed,
    nonmaritalSetAside,
    distributionWithExclusions,
    baselineWithoutExclusions,
    exclusions,
    unequalDistributionFactors: EQUITABLE_DISTRIBUTION_FACTORS,
  };

  return calculatedOutcome({
    rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
    result,
    formulaTrace,
    citations,
    assumptions,
    warnings,
  });
}
