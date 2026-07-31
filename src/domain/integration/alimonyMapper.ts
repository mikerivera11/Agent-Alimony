import type { ReviewedIntakeDraft } from "@/domain/intake";
import {
  confirmFact,
  type AlimonyInput,
  type ConfirmedFact,
} from "@/domain/rules";

import { mapStatutoryDeductions, sumGrossIncomeDollars } from "./childSupportMapper";
import { dollarsToCents, mapped, unmapped, type MappingIssue, type MappingResult } from "./mappingIssue";

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
  const { alimonyFactors, caseBasics, deductions, income, marriage, safetyComplexity } = reviewed.data;

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

  const value: AlimonyInput = {
    marriageDateIso: marriage.marriageDate,
    petitionFilingDateIso: caseBasics.petitionDate,
    payor: recipientIsSelf ? spouse : self,
    obligee: recipientIsSelf ? self : spouse,
    confirmedReasonableMonthlyNeedCents: dollarsToCents(
      alimonyFactors.confirmedReasonableMonthlyNeed,
    ),
    rehabilitativePlanConfirmed: alimonyFactors.rehabilitativePlanConfirmed === "yes",
    exceptionalCircumstancesExtensionRequested:
      alimonyFactors.exceptionalCircumstancesExtensionRequested === "yes",
    needDisputed: safetyComplexity.incomeIsImputedOrDisputed === "yes",
    abilityToPayDisputed: safetyComplexity.incomeIsImputedOrDisputed === "yes",
  };

  return mapped(confirmFact(value, "user-entered", reviewed.reviewedAt), issues);
}

export type AlimonyMappingResult = MappingResult<ConfirmedFact<AlimonyInput>>;
