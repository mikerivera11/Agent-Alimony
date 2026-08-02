/**
 * Pure mapper: `ReviewedIntakeDraft` -> Fla. Stat. §61.30 child support input.
 *
 * Intake stores whole/fractional-dollar monthly amounts; the rules engine
 * requires integer cents, so every dollar figure is converted with
 * `dollarsToCents`. This mapper deliberately:
 *  - sums the gross-income categories §61.30(2)(a) counts into a single
 *    monthly gross figure, and excludes nonrecurring gains, which
 *    §61.30(2)(a)14 does not count;
 *  - maps only the statutory deductions §61.30(3)(a),(b),(d),(e) list
 *    (income tax withholding, FICA/self-employment tax, mandatory
 *    retirement, self-only health insurance) and never counts union dues,
 *    which are not an allowable §61.30(3) deduction;
 *  - maps separately confirmed other-child and prior-spousal support;
 *  - maps each parent's directly paid child-care/health costs without
 *    inventing a split.
 */
import {
  confirmFact,
  type ChildSupportDeductions,
  type ChildSupportInput,
  type ConfirmedFact,
} from "@/domain/rules";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import type { PersonDeductions, PersonIncome } from "@/domain/intake";

import { dollarsToCents, mapped, unmapped, type MappingIssue, type MappingResult } from "./mappingIssue";

const DEFAULT_ANNUAL_PERIOD_NIGHTS = 365;
const LEAP_YEAR_PERIOD_NIGHTS = 366;

/**
 * Monthly gross income under Fla. Stat. §61.30(2)(a).
 *
 * This one function is the single definition of gross income for the whole
 * app: child support reads it, and §61.08(8)(c) directs that alimony net
 * income "shall be calculated in conformity with s. 61.30(2) and (3)", so the
 * alimony 35% cap and the reasonable-need estimate read it too. Adding a
 * category here therefore changes both calculations at once, which is the
 * point — they are not permitted to disagree about what income is.
 *
 * `nonrecurringGains` is deliberately absent from this sum. §61.30(2)(a)14
 * counts "[g]ains derived from dealings in property, unless the gain is
 * nonrecurring", so a one-time sale is not gross income. It is still
 * collected and reported, because §61.30(13) lets a court order support paid
 * out of nonrecurring income where recurring income cannot meet the child's
 * needs — but that is a judicial decision, not a line in this sum.
 */
export function sumGrossIncomeDollars(person: PersonIncome): number {
  return (
    person.wages +
    person.selfEmploymentIncome +
    person.bonusesAndCommissions +
    person.equityCompensation +
    person.investmentIncome +
    person.recurringCapitalGains +
    person.rentalIncome +
    person.retirementOrPensionIncome +
    person.unemploymentBenefits +
    person.disabilityBenefits +
    person.otherIncome
  );
}

export function mapStatutoryDeductions(deductions: PersonDeductions): ChildSupportDeductions {
  return {
    federalStateLocalIncomeTaxCents: dollarsToCents(deductions.federalAndStateTaxWithholding),
    ficaOrSelfEmploymentTaxCents: dollarsToCents(deductions.socialSecurityAndMedicareTax),
    mandatoryRetirementCents: dollarsToCents(deductions.mandatoryRetirementContributions),
    healthInsurancePremiumSelfOnlyCents: dollarsToCents(deductions.healthInsurancePremiumsForSelf),
    courtOrderedSupportForOtherChildrenPaidCents: dollarsToCents(
      deductions.courtOrderedChildSupportPaidForOtherChildren,
    ),
    spousalSupportPaidUnderPriorOrderCents: dollarsToCents(deductions.spousalSupportPaidUnderPriorOrder),
  };
}

/**
 * Maps a fully-validated `ReviewedIntakeDraft` onto a
 * `ConfirmedFact<ChildSupportInput>`, or returns typed issues explaining why
 * it could not. Never throws; never guesses at data intake does not collect.
 */
export function mapReviewedDraftToChildSupportInput(
  reviewed: ReviewedIntakeDraft,
): MappingResult<ConfirmedFact<ChildSupportInput>> {
  const { children, parentingTime, income, deductions, childCosts } = reviewed.data;

  if (children.hasChildren !== "yes" || children.children.length === 0) {
    return unmapped([
      {
        code: "no-shared-minor-children",
        severity: "info",
        message: "No shared minor children were reported, so Fla. Stat. §61.30 child support does not apply.",
      },
    ]);
  }

  if (!parentingTime || !childCosts) {
    return unmapped([
      {
        code: "insufficient-child-support-data",
        severity: "blocking",
        message:
          "Parenting-time overnights and/or child-care/health-cost information is missing, so a Fla. Stat. " +
          "§61.30 child support calculation cannot be safely produced.",
      },
    ]);
  }

  const issues: MappingIssue[] = [];

  const selfDeductions = mapStatutoryDeductions(deductions.self);
  const spouseDeductions = mapStatutoryDeductions(deductions.spouse);

  const totalOvernights =
    parentingTime.overnightsWithYouPerYear + parentingTime.overnightsWithOtherParentPerYear;
  const totalNightsInPeriod =
    totalOvernights > DEFAULT_ANNUAL_PERIOD_NIGHTS ? LEAP_YEAR_PERIOD_NIGHTS : DEFAULT_ANNUAL_PERIOD_NIGHTS;

  if (childCosts.extraordinaryMedicalCostsMonthly > 0 || childCosts.extraordinaryEducationalCostsMonthly > 0) {
    issues.push({
      code: "unsupported-extraordinary-child-costs",
      severity: "info",
      message:
        "Extraordinary medical and/or educational costs entered during intake are not currently supported as " +
        "separate add-ons by this child-support ruleset implementation and were excluded from this calculation.",
    });
  }

  const value: ChildSupportInput = {
    numberOfChildren: children.children.length,
    parents: [
      {
        parentId: "parent1",
        monthlyGrossIncomeCents: dollarsToCents(sumGrossIncomeDollars(income.self)),
        deductions: selfDeductions,
        overnightsWithChild: parentingTime.overnightsWithYouPerYear,
        childCarePrepaidCents: dollarsToCents(childCosts.childCarePaidBySelfMonthly),
        childHealthCostsPrepaidCents: dollarsToCents(childCosts.childHealthInsurancePaidBySelfMonthly),
      },
      {
        parentId: "parent2",
        monthlyGrossIncomeCents: dollarsToCents(sumGrossIncomeDollars(income.spouse)),
        deductions: spouseDeductions,
        overnightsWithChild: parentingTime.overnightsWithOtherParentPerYear,
        childCarePrepaidCents: dollarsToCents(childCosts.childCarePaidByOtherParentMonthly),
        childHealthCostsPrepaidCents: dollarsToCents(childCosts.childHealthInsurancePaidByOtherParentMonthly),
      },
    ],
    totalNightsInPeriod,
    monthlyChildCareCostsCents: dollarsToCents(childCosts.childCareCostMonthly),
    monthlyChildHealthInsuranceCents: dollarsToCents(childCosts.childrenHealthInsuranceCostMonthly),
  };

  return mapped(confirmFact(value, "user-entered", reviewed.reviewedAt), issues);
}
