import type { ReviewedIntakeDraft } from "@/domain/intake";
import {
  confirmFact,
  type AlimonyInput,
  type ConfirmedFact,
} from "@/domain/rules";

import { mapStatutoryDeductions, sumGrossIncomeDollars } from "./childSupportMapper";
import { dollarsToCents, mapped, unmapped, type MappingIssue, type MappingResult } from "./mappingIssue";
import { resolveReasonableMonthlyNeed } from "./reasonableNeed";

function formatCents(value: number): string {
  return `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function partyInput(
  income: ReviewedIntakeDraft["data"]["income"]["self"],
  deductions: ReviewedIntakeDraft["data"]["deductions"]["self"],
): AlimonyInput["payor"] {
  return {
    monthlyGrossIncomeCents: dollarsToCents(sumGrossIncomeDollars(income)),
    deductions: mapStatutoryDeductions(deductions),
  };
}

export function mapReviewedDraftToAlimonyInput(
  reviewed: ReviewedIntakeDraft,
): MappingResult<ConfirmedFact<AlimonyInput>> {
  const { alimonyFactors, caseBasics, deductions, householdExpenses, income, marriage, safetyComplexity } =
    reviewed.data;

  if (
    alimonyFactors.requestedAlimonyType === "none" ||
    alimonyFactors.potentialAlimonyRecipient === "none"
  ) {
    return unmapped([
      {
        code: "alimony-not-requested",
        severity: "info",
        message: "No alimony calculation was produced because the reviewed facts say alimony is not requested.",
      },
    ]);
  }

  if (alimonyFactors.potentialAlimonyRecipient === "not_sure") {
    return unmapped([
      {
        code: "needs-explicit-recipient",
        severity: "blocking",
        message:
          "Choose who may receive alimony for this planning scenario. The app will not assume the lower earner is the recipient.",
      },
    ]);
  }

  const self = partyInput(income.self, deductions.self);
  const spouse = partyInput(income.spouse, deductions.spouse);
  const recipientIsSelf = alimonyFactors.potentialAlimonyRecipient === "self";
  const issues: MappingIssue[] = [];

  if (caseBasics.petitionStatus === "not_filed") {
    issues.push({
      code: "planned-petition-date",
      severity: "info",
      message:
        `No petition has been filed. The estimate uses ${caseBasics.petitionDate} as the user-confirmed planning date; actual filing timing can change marriage duration.`,
    });
  }

  const need = resolveReasonableMonthlyNeed(
    alimonyFactors.confirmedReasonableMonthlyNeed,
    householdExpenses,
    recipientIsSelf ? income.self : income.spouse,
    recipientIsSelf ? deductions.self : deductions.spouse,
  );

  if (need.basis === "derived-from-budget") {
    issues.push({
      code: "reasonable-need-derived-from-budget",
      severity: "info",
      message:
        `No documented monthly need was entered, so the estimate uses the monthly shortfall calculated from your own ` +
        `figures: ${formatCents(need.monthlyLivingExpensesCents)} of monthly living expenses less ` +
        `${formatCents(need.recipientNetMonthlyIncomeCents)} of the recipient's net monthly income = ` +
        `${formatCents(need.derivedMonthlyNeedCents)}. Those expenses describe the household you entered on the ` +
        `expenses topic; if they cover both spouses, one person's separate need after a divorce is usually lower. ` +
        `Enter a documented figure on the alimony topic to override this.`,
    });

    if (need.derivedMonthlyNeedCents === 0) {
      issues.push({
        code: "reasonable-need-zero",
        severity: "warning",
        message:
          `The recipient's net monthly income (${formatCents(need.recipientNetMonthlyIncomeCents)}) already covers ` +
          `the monthly living expenses entered (${formatCents(need.monthlyLivingExpensesCents)}), so the calculated ` +
          `need is $0.00 and the alimony ceiling is $0.00. If living expenses are missing or understated, revisit the ` +
          `expenses topic; the ceiling depends directly on that figure.`,
      });
    }
  }

  const value: AlimonyInput = {
    marriageDateIso: marriage.marriageDate,
    petitionFilingDateIso: caseBasics.petitionDate,
    payor: recipientIsSelf ? spouse : self,
    obligee: recipientIsSelf ? self : spouse,
    confirmedReasonableMonthlyNeedCents: need.monthlyNeedCents,
    rehabilitativePlanConfirmed: alimonyFactors.rehabilitativePlanConfirmed === "yes",
    exceptionalCircumstancesExtensionRequested:
      alimonyFactors.exceptionalCircumstancesExtensionRequested === "yes",
    needDisputed: safetyComplexity.incomeIsImputedOrDisputed === "yes",
    abilityToPayDisputed: safetyComplexity.incomeIsImputedOrDisputed === "yes",
  };

  return mapped(confirmFact(value, "user-entered", reviewed.reviewedAt), issues);
}

export type AlimonyMappingResult = MappingResult<ConfirmedFact<AlimonyInput>>;
