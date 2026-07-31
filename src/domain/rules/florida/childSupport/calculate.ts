/**
 * Fla. Stat. §61.30 child support calculation.
 *
 * Pure function: given a `ConfirmedFact<ChildSupportInput>`, returns a
 * `RuleOutcome<ChildSupportResult>` with a full formula trace. No I/O, no AI
 * or server imports — only the statutory schedule fixture and the shared
 * money/date/registry primitives in this package.
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
  clampToZero,
  minCents,
  roundHalfUp,
  subtractCents,
  twoWayBasisPointShare,
  ZERO_CENTS,
} from "../../money";
import {
  calculatedOutcome,
  needsInputOutcome,
  notImplementedOutcome,
  type FormulaStep,
  type RuleFlag,
  type RuleOutcome,
} from "../../types";
import { FLORIDA_CHILD_SUPPORT_STATUTE_CITATION } from "../metadata";
import {
  SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS,
  lookupScheduleAmount,
} from "./schedule";
import {
  childSupportInputSchema,
  type ChildSupportInput,
  type ChildSupportParentId,
  type ChildSupportParentResult,
  type ChildSupportResult,
} from "./types";

export const FLORIDA_CHILD_SUPPORT_RULESET_ID = "fl-child-support-61.30";

const MAX_SUPPORTED_CHILDREN = 6;
const SUBSTANTIAL_TIME_SHARING_THRESHOLD_BASIS_POINTS = 2_000; // 20.00%
const GROSS_UP_MULTIPLIER_NUMERATOR = 3; // 1.5x expressed as an exact integer ratio (3/2)
const GROSS_UP_MULTIPLIER_DENOMINATOR = 2;
const GROSS_INCOME_DEVIATION_THRESHOLD_BASIS_POINTS = 5_500; // 55.00%

const citation = FLORIDA_CHILD_SUPPORT_STATUTE_CITATION;

function sumDeductions(deductions: ChildSupportInput["parents"][number]["deductions"]): Cents {
  return addCents(
    cents(deductions.federalStateLocalIncomeTaxCents),
    cents(deductions.ficaOrSelfEmploymentTaxCents),
    cents(deductions.mandatoryRetirementCents),
    cents(deductions.healthInsurancePremiumSelfOnlyCents),
    cents(deductions.courtOrderedSupportForOtherChildrenPaidCents),
    cents(deductions.spousalSupportPaidUnderPriorOrderCents),
  );
}

function otherParentIndex(index: 0 | 1): 0 | 1 {
  return index === 0 ? 1 : 0;
}

export function calculateFloridaChildSupport(
  input: ConfirmedFact<ChildSupportInput>,
): RuleOutcome<ChildSupportResult> {
  assertConfirmedFact<ChildSupportInput>(input);
  const raw = unwrapConfirmedFact(input);

  const parsed = childSupportInputSchema.safeParse(raw);
  if (!parsed.success) {
    return needsInputOutcome({
      rulesetId: FLORIDA_CHILD_SUPPORT_RULESET_ID,
      message: "One or more child support inputs are missing or invalid.",
      missingFacts: parsed.error.issues.map((issue) => ({
        factId: issue.path.join(".") || "root",
        description: issue.message,
      })),
    });
  }
  const value = parsed.data;

  if (value.numberOfChildren > MAX_SUPPORTED_CHILDREN) {
    return notImplementedOutcome({
      rulesetId: FLORIDA_CHILD_SUPPORT_RULESET_ID,
      reason: `This ruleset supports 1-${MAX_SUPPORTED_CHILDREN} children. Fla. Stat. §61.30(12) provides additional instructions for more than six children that are not yet implemented.`,
      citations: [citation],
    });
  }

  const formulaTrace: FormulaStep[] = [];
  const warnings: RuleFlag[] = [];
  const assumptions: string[] = [
    "Table-row selection normalizes combined net income down to its $50 statutory bracket floor rather than interpolating between rows.",
    "Child care and health-insurance add-ons are added at their full confirmed cost; no federal tax-credit reduction is applied because current Fla. Stat. §61.30(7)-(8) text does not provide one.",
    "Overnights are measured against a configurable annual period (default 365 nights); leap years should supply totalNightsInPeriod = 366.",
  ];

  // Ordered by parentId so [0] is always parent1 and [1] is always parent2.
  const parents = [...value.parents].sort((a, b) => a.parentId.localeCompare(b.parentId)) as [
    ChildSupportInput["parents"][number],
    ChildSupportInput["parents"][number],
  ];

  const grossCents = parents.map((p) => cents(p.monthlyGrossIncomeCents)) as [Cents, Cents];
  const deductionCents = parents.map((p) => sumDeductions(p.deductions)) as [Cents, Cents];
  const netCentsRaw = grossCents.map((gross, i) => subtractCents(gross, deductionCents[i])) as [
    Cents,
    Cents,
  ];
  const netCents = netCentsRaw.map((net, i) => {
    if (net < 0) {
      warnings.push({
        flagId: `deductionsExceedGrossIncome:${parents[i].parentId}`,
        description: `${parents[i].parentId}'s allowable deductions exceed gross income; net income was floored at $0.00 instead of going negative.`,
        severity: "warning",
        citation: citation.citation,
      });
      return ZERO_CENTS;
    }
    return net;
  }) as [Cents, Cents];

  formulaTrace.push({
    stepId: "net-income",
    description: "Gross income minus allowable deductions, per parent (§61.30(2)-(4)).",
    citation: "Fla. Stat. §61.30(2)-(4)",
    values: {
      parent1GrossCents: grossCents[0],
      parent1DeductionsCents: deductionCents[0],
      parent1NetCents: netCents[0],
      parent2GrossCents: grossCents[1],
      parent2DeductionsCents: deductionCents[1],
      parent2NetCents: netCents[1],
    },
  });

  const combinedNetCents = addCents(netCents[0], netCents[1]);
  formulaTrace.push({
    stepId: "combined-net-income",
    description: "Sum of both parents' net monthly income.",
    citation: "Fla. Stat. §61.30(5)",
    values: { combinedNetMonthlyIncomeCents: combinedNetCents },
  });

  // §61.30(6)(a): if either parent's own net income is below the schedule
  // minimum, the statute requires comparing that parent's income against
  // HHS federal poverty guidelines (90% of the difference). This ruleset
  // does not source poverty-guideline data, so it deliberately does not
  // guess at that branch.
  if (combinedNetCents < SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS) {
    return notImplementedOutcome({
      rulesetId: FLORIDA_CHILD_SUPPORT_RULESET_ID,
      reason:
        "Combined net income is below the $800 statutory schedule minimum. Fla. Stat. §61.30(6)(a) requires a case-specific amount and a current HHS federal poverty-guideline comparison; this ruleset does not source that annually changing figure and will not guess.",
      citations: [citation],
    });
  }

  const scheduleLookup = lookupScheduleAmount(combinedNetCents, value.numberOfChildren);
  formulaTrace.push({
    stepId: "schedule-lookup",
    description: scheduleLookup.wasAboveSchedule
      ? "Combined net income exceeds the $10,000 schedule ceiling; minimum need is the top-row amount plus the statutory percentage of income over $10,000."
      : "Minimum child support need looked up from the §61.30(6) guidelines schedule.",
    citation: "Fla. Stat. §61.30(6)",
    values: {
      requestedCombinedNetIncomeCents: scheduleLookup.requestedCombinedNetIncomeCents,
      scheduleRowCombinedNetIncomeCents: scheduleLookup.rowCombinedNetIncomeCents,
      normalizedToTableRow: scheduleLookup.normalizedToTableRow,
      wasAboveSchedule: scheduleLookup.wasAboveSchedule,
      basicMonthlyNeedCents: scheduleLookup.basicMonthlyNeedCents,
    },
  });

  const childCareAddOnCents = cents(value.monthlyChildCareCostsCents);
  const childHealthAddOnCents = cents(value.monthlyChildHealthInsuranceCents);
  const totalNeedCents = addCents(
    scheduleLookup.basicMonthlyNeedCents,
    childCareAddOnCents,
    childHealthAddOnCents,
  );
  formulaTrace.push({
    stepId: "total-minimum-need",
    description: "Basic schedule amount plus child-care and child-health-insurance add-ons.",
    citation: "Fla. Stat. §61.30(7)-(8)",
    values: {
      basicMonthlyNeedCents: scheduleLookup.basicMonthlyNeedCents,
      childCareAddOnCents,
      childHealthAddOnCents,
      totalMinimumChildSupportNeedCents: totalNeedCents,
    },
  });

  const [incomeShare0, incomeShare1] = twoWayBasisPointShare(netCents[0], netCents[1]);
  const incomeShareBasisPoints: [number, number] = [incomeShare0, incomeShare1];
  formulaTrace.push({
    stepId: "income-percentage-shares",
    description: "Each parent's percentage share of combined net income.",
    citation: "Fla. Stat. §61.30(9)",
    values: {
      parent1IncomeSharePercentBasisPoints: incomeShareBasisPoints[0],
      parent2IncomeSharePercentBasisPoints: incomeShareBasisPoints[1],
    },
  });

  const overnights = parents.map((p) => p.overnightsWithChild) as [number, number];
  const overnightShareBasisPoints: [number, number] = [
    roundHalfUp((overnights[0] * 10_000) / value.totalNightsInPeriod),
    roundHalfUp((overnights[1] * 10_000) / value.totalNightsInPeriod),
  ];

  const substantialTimeSharingApplied =
    Math.min(overnightShareBasisPoints[0], overnightShareBasisPoints[1]) >=
    SUBSTANTIAL_TIME_SHARING_THRESHOLD_BASIS_POINTS;

  let obligorIndex: 0 | 1;
  let monthlyTransferCents: Cents;
  const dollarShareOfTotalNeed = allocateProportionally(totalNeedCents, [
    incomeShareBasisPoints[0],
    incomeShareBasisPoints[1],
  ]) as [Cents, Cents];

  if (!substantialTimeSharingApplied) {
    // Standard model: the parent with fewer overnights is the obligor and
    // pays their own dollar share of the total need, less anything they
    // already prepaid directly for add-ons. Fla. Stat. §61.30(7)-(10).
    obligorIndex = overnights[0] <= overnights[1] ? 0 : 1;
    const obligorPrepaid = addCents(
      cents(parents[obligorIndex].childCarePrepaidCents),
      cents(parents[obligorIndex].childHealthCostsPrepaidCents),
    );
    const rawObligation = subtractCents(dollarShareOfTotalNeed[obligorIndex], obligorPrepaid);
    if (rawObligation < 0) {
      warnings.push({
        flagId: "obligorPrepaidExceedsShare",
        description:
          "The obligor's prepaid child-care/health-insurance amounts exceed their calculated dollar share; the transfer amount was floored at $0.00 rather than made negative. Any reimbursement owed to the obligor is outside this ruleset's scope.",
        severity: "info",
        citation: citation.citation,
      });
    }
    monthlyTransferCents = clampToZero(rawObligation);

    formulaTrace.push({
      stepId: "standard-obligation",
      description:
        "Standard model: obligor (fewer overnights) pays their dollar share of total need, net of their own prepaid add-on costs.",
      citation: "Fla. Stat. §61.30(9)-(10)",
      values: {
        obligorParentId: parents[obligorIndex].parentId,
        obligorDollarShareOfTotalNeedCents: dollarShareOfTotalNeed[obligorIndex],
        obligorPrepaidCents: obligorPrepaid,
        monthlyTransferAmountBeforeSsCreditCents: monthlyTransferCents,
      },
    });
  } else {
    // Substantial time-sharing gross-up. Fla. Stat. §61.30(11)(b).
    const adjustedBasicNeed = cents(
      Math.round(
        (scheduleLookup.basicMonthlyNeedCents * GROSS_UP_MULTIPLIER_NUMERATOR) /
          GROSS_UP_MULTIPLIER_DENOMINATOR,
      ),
    );
    const basicShare = allocateProportionally(adjustedBasicNeed, [
      incomeShareBasisPoints[0],
      incomeShareBasisPoints[1],
    ]) as [Cents, Cents];

    // §61.30(11)(b)3: multiply each parent's step-1 share by the OTHER
    // parent's overnight percentage.
    const crossObligation: [Cents, Cents] = [
      cents(roundHalfUp((basicShare[0] * overnightShareBasisPoints[1]) / 10_000)),
      cents(roundHalfUp((basicShare[1] * overnightShareBasisPoints[0]) / 10_000)),
    ];

    obligorIndex = crossObligation[0] >= crossObligation[1] ? 0 : 1;
    const obligeeIndex = otherParentIndex(obligorIndex);
    const baseTransferCents = subtractCents(
      crossObligation[obligorIndex],
      crossObligation[obligeeIndex],
    );

    formulaTrace.push({
      stepId: "gross-up-basic-transfer",
      description:
        "1.5x-adjusted basic need apportioned by income share, then cross-multiplied by the other parent's overnight share; the difference is the base transfer.",
      citation: "Fla. Stat. §61.30(11)(b)1.-4.",
      values: {
        adjustedBasicNeedCents: adjustedBasicNeed,
        parent1BasicShareCents: basicShare[0],
        parent2BasicShareCents: basicShare[1],
        parent1OvernightSharePercentBasisPoints: overnightShareBasisPoints[0],
        parent2OvernightSharePercentBasisPoints: overnightShareBasisPoints[1],
        parent1CrossObligationCents: crossObligation[0],
        parent2CrossObligationCents: crossObligation[1],
        obligorParentId: parents[obligorIndex].parentId,
        baseTransferAmountCents: baseTransferCents,
      },
    });

    // §61.30(11)(b)5.-6.: net day-care/health-insurance amount each parent
    // owes (their income-percentage share of those add-ons, minus what they
    // already prepaid), then credit/debit the base transfer accordingly.
    const addOnTotalCents = addCents(childCareAddOnCents, childHealthAddOnCents);
    const addOnShare = allocateProportionally(addOnTotalCents, [
      incomeShareBasisPoints[0],
      incomeShareBasisPoints[1],
    ]) as [Cents, Cents];
    const prepaidByParent = parents.map((p) =>
      addCents(cents(p.childCarePrepaidCents), cents(p.childHealthCostsPrepaidCents)),
    ) as [Cents, Cents];
    const netAddOnOwed: [Cents, Cents] = [
      subtractCents(addOnShare[0], prepaidByParent[0]),
      subtractCents(addOnShare[1], prepaidByParent[1]),
    ];
    // Positive adjustment increases the obligor's payment (the obligee
    // prepaid more than their share, or the obligor prepaid less than
    // theirs); negative decreases it.
    const addOnAdjustmentCents = subtractCents(
      netAddOnOwed[obligorIndex],
      netAddOnOwed[obligeeIndex],
    );

    formulaTrace.push({
      stepId: "gross-up-addon-adjustment",
      description:
        "Add-on costs apportioned by income share, netted against each parent's direct prepayments, then credited/debited against the base transfer.",
      citation: "Fla. Stat. §61.30(11)(b)5.-6.",
      values: {
        childCareAddOnCents,
        childHealthAddOnCents,
        parent1AddOnShareCents: addOnShare[0],
        parent2AddOnShareCents: addOnShare[1],
        parent1PrepaidCents: prepaidByParent[0],
        parent2PrepaidCents: prepaidByParent[1],
        addOnAdjustmentToObligorPaymentCents: addOnAdjustmentCents,
      },
    });

    const rawTransfer = addCents(baseTransferCents, addOnAdjustmentCents);
    monthlyTransferCents = clampToZero(rawTransfer);
    if (rawTransfer < 0) {
      warnings.push({
        flagId: "grossUpAddOnCreditExceedsBaseTransfer",
        description:
          "The obligee's net add-on prepayment credit exceeds the base gross-up transfer; the amount was floored at $0.00. A reimbursement in the other direction is outside this ruleset's scope.",
        severity: "info",
        citation: citation.citation,
      });
    }
  }

  if (netCents[obligorIndex] < SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS) {
    return notImplementedOutcome({
      rulesetId: FLORIDA_CHILD_SUPPORT_RULESET_ID,
      reason:
        "The calculated obligor's net monthly income is below the $800 statutory schedule minimum. Fla. Stat. §61.30(6)(a) requires comparison with the current HHS federal poverty guideline; this ruleset does not source that annually changing figure and will not guess.",
      citations: [citation],
    });
  }

  // §61.30(10)(b): Social Security child-benefit credit, applied only when
  // it is safely deterministic — i.e. attributable to the parent who is
  // actually the calculated obligor in this scenario.
  let ssCreditAppliedCents: Cents = ZERO_CENTS;
  if (value.socialSecurityChildBenefitCredit) {
    const credit = value.socialSecurityChildBenefitCredit;
    if (credit.attributableToParentId === parents[obligorIndex].parentId) {
      ssCreditAppliedCents = minCents(
        cents(credit.monthlyBenefitPaidToChildOrCaregiverCents),
        monthlyTransferCents,
      );
      const excessCents = subtractCents(
        cents(credit.monthlyBenefitPaidToChildOrCaregiverCents),
        ssCreditAppliedCents,
      );
      if (excessCents > 0) {
        warnings.push({
          flagId: "socialSecurityBenefitExceedsObligation",
          description:
            "The Social Security child benefit exceeds the obligor's monthly obligation; the excess inures to the child's benefit and may not be credited to arrears or retroactive support.",
          severity: "info",
          citation: "Fla. Stat. §61.30(10)(b)1.",
        });
      }
      monthlyTransferCents = subtractCents(monthlyTransferCents, ssCreditAppliedCents);
      formulaTrace.push({
        stepId: "social-security-credit",
        description: "Social Security child benefit credited against the obligor's monthly obligation.",
        citation: "Fla. Stat. §61.30(10)(b)",
        values: {
          attributableToParentId: credit.attributableToParentId,
          monthlyBenefitCents: credit.monthlyBenefitPaidToChildOrCaregiverCents,
          creditAppliedCents: ssCreditAppliedCents,
        },
      });
    } else {
      warnings.push({
        flagId: "socialSecurityCreditNotAttributableToObligor",
        description:
          "A Social Security child benefit was provided but is not attributable to the calculated obligor; crediting it against the obligee's own share is fact-specific and was not applied. Professional review recommended if a credit is sought.",
        severity: "warning",
        citation: "Fla. Stat. §61.30(10)(b)",
      });
    }
  }

  // §61.30(11)(a)9: >55% of gross income is a deviation factor, not a clamp.
  if (grossCents[obligorIndex] > 0) {
    const paymentBasisPointsOfGross = roundHalfUp(
      (monthlyTransferCents * 10_000) / grossCents[obligorIndex],
    );
    if (paymentBasisPointsOfGross > GROSS_INCOME_DEVIATION_THRESHOLD_BASIS_POINTS) {
      warnings.push({
        flagId: "obligationExceeds55PercentOfGrossIncome",
        description:
          "The obligor's monthly payment exceeds 55% of their gross income. This is a statutory deviation factor the court may consider, not an automatic cap or clamp on the calculated amount.",
        severity: "warning",
        citation: "Fla. Stat. §61.30(11)(a)9.",
      });
    }
  }

  function buildParentResult(idx: 0 | 1): ChildSupportParentResult {
    const isObligor = idx === obligorIndex;
    return {
      parentId: parents[idx].parentId,
      monthlyGrossIncomeCents: grossCents[idx],
      monthlyNetIncomeCents: netCents[idx],
      incomeSharePercentBasisPoints: incomeShareBasisPoints[idx],
      overnightsWithChild: overnights[idx],
      overnightSharePercentBasisPoints: overnightShareBasisPoints[idx],
      dollarShareOfTotalNeedCents: dollarShareOfTotalNeed[idx],
      monthlyPaymentOwedCents: isObligor ? monthlyTransferCents : ZERO_CENTS,
    };
  }
  const parentResults: [ChildSupportParentResult, ChildSupportParentResult] = [
    buildParentResult(0),
    buildParentResult(1),
  ];

  const result: ChildSupportResult = {
    numberOfChildren: value.numberOfChildren,
    combinedNetMonthlyIncomeCents: combinedNetCents,
    scheduleRowCombinedNetIncomeCents: scheduleLookup.rowCombinedNetIncomeCents,
    scheduleRowNormalizedFromRequestedIncome: scheduleLookup.normalizedToTableRow,
    wasAboveSchedule: scheduleLookup.wasAboveSchedule,
    basicMonthlyNeedCents: scheduleLookup.basicMonthlyNeedCents,
    childCareAddOnCents,
    childHealthInsuranceAddOnCents: childHealthAddOnCents,
    totalMinimumChildSupportNeedCents: totalNeedCents,
    substantialTimeSharingApplied,
    obligorParentId: parents[obligorIndex].parentId as ChildSupportParentId,
    monthlyTransferAmountCents: monthlyTransferCents,
    socialSecurityCreditAppliedCents: ssCreditAppliedCents,
    parents: parentResults,
  };

  return calculatedOutcome({
    rulesetId: FLORIDA_CHILD_SUPPORT_RULESET_ID,
    result,
    formulaTrace,
    citations: [citation],
    assumptions,
    warnings,
  });
}
