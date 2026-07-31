import type { ReviewedIntakeDraft } from "@/domain/intake";

import type { ConfirmedFactEntry } from "./types";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function money(amount: number): string {
  return dollars.format(amount);
}

function yesNo(value: "yes" | "no" | undefined): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "Not answered";
}

/**
 * Flattens every topic of a `ReviewedIntakeDraft` into a flat list of
 * human-readable, provenance-tagged confirmed facts for display in the
 * results UI and the PDF. Every entry's provenance is `"user-entered"`
 * because a `ReviewedIntakeDraft` only ever exists once the person has
 * personally entered and reviewed every applicable topic in the wizard —
 * there is no AI/document-extraction path into this type.
 */
export function buildConfirmedFactEntries(reviewed: ReviewedIntakeDraft): ConfirmedFactEntry[] {
  const {
    caseBasics,
    marriage,
    spouses,
    children,
    parentingTime,
    income,
    deductions,
    childCosts,
    householdExpenses,
    assetsDebts,
    alimonyFactors,
    safetyComplexity,
    documentReadiness,
  } = reviewed.data;

  const entries: ConfirmedFactEntry[] = [];
  const push = (sectionId: string, sectionTitle: string, label: string, value: string) => {
    entries.push({ sectionId, sectionTitle, label, value, provenance: "user-entered" });
  };

  push("case", "Case basics", "County", caseBasics.county);
  push("case", "Case basics", "Case type", caseBasics.caseType === "with_children" ? "With children" : "Without children");
  push(
    "case",
    "Case basics",
    "Petition status",
    caseBasics.petitionStatus === "filed" ? `Filed (${caseBasics.petitionDate ?? "date not recorded"})` : "Not yet filed",
  );
  push("case", "Case basics", "Has an attorney", yesNo(caseBasics.hasAttorney));

  push("marriage", "Marriage", "Marriage date", marriage.marriageDate);
  push(
    "marriage",
    "Marriage",
    "Separation status",
    marriage.separationStatus === "separated_with_date"
      ? `Separated (${marriage.separationDate ?? "date not recorded"})`
      : marriage.separationStatus === "separated_no_date"
        ? "Separated (no date recorded)"
        : "Living together",
  );

  push("parties", "Parties", "Your role", spouses.yourRole);
  push("parties", "Parties", "You", spouses.yourNameOrInitials);
  push("parties", "Parties", "Your spouse", spouses.spouseNameOrInitials);

  push("children", "Children", "Has shared minor children", yesNo(children.hasChildren));
  children.children.forEach((child, index) => {
    push(
      "children",
      "Children",
      `Child ${index + 1}`,
      `${child.nameOrInitials}, born ${child.dateOfBirth}${child.hasSpecialNeeds === "yes" ? " (special needs noted)" : ""}`,
    );
  });

  if (parentingTime) {
    push("parentingTime", "Parenting time", "Overnights with you per year", String(parentingTime.overnightsWithYouPerYear));
    push(
      "parentingTime",
      "Parenting time",
      "Overnights with the other parent per year",
      String(parentingTime.overnightsWithOtherParentPerYear),
    );
    push("parentingTime", "Parenting time", "Schedule status", parentingTime.scheduleStatus);
  }

  const selfGross =
    income.self.wages +
    income.self.selfEmploymentIncome +
    income.self.bonusesAndCommissions +
    income.self.investmentIncome +
    income.self.rentalIncome +
    income.self.retirementOrPensionIncome +
    income.self.unemploymentBenefits +
    income.self.disabilityBenefits +
    income.self.otherIncome;
  const spouseGross =
    income.spouse.wages +
    income.spouse.selfEmploymentIncome +
    income.spouse.bonusesAndCommissions +
    income.spouse.investmentIncome +
    income.spouse.rentalIncome +
    income.spouse.retirementOrPensionIncome +
    income.spouse.unemploymentBenefits +
    income.spouse.disabilityBenefits +
    income.spouse.otherIncome;
  push("income", "Gross income", "Your total monthly gross income", money(selfGross));
  push("income", "Gross income", "Your spouse's total monthly gross income", money(spouseGross));
  if (income.incomeNotes) {
    push("income", "Gross income", "Income notes", income.incomeNotes);
  }

  push(
    "deductions",
    "Deductions",
    "Your allowable deductions (tax, FICA, retirement, health insurance)",
    money(
      deductions.self.federalAndStateTaxWithholding +
        deductions.self.socialSecurityAndMedicareTax +
        deductions.self.mandatoryRetirementContributions +
        deductions.self.healthInsurancePremiumsForSelf,
    ),
  );
  push(
    "deductions",
    "Deductions",
    "Your spouse's allowable deductions (tax, FICA, retirement, health insurance)",
    money(
      deductions.spouse.federalAndStateTaxWithholding +
        deductions.spouse.socialSecurityAndMedicareTax +
        deductions.spouse.mandatoryRetirementContributions +
        deductions.spouse.healthInsurancePremiumsForSelf,
    ),
  );
  if (deductions.self.unionDues > 0 || deductions.spouse.unionDues > 0) {
    push(
      "deductions",
      "Deductions",
      "Union dues entered (not an allowable §61.30(3) deduction)",
      `You: ${money(deductions.self.unionDues)} · Spouse: ${money(deductions.spouse.unionDues)}`,
    );
  }
  if (
    deductions.self.courtOrderedChildSupportPaidForOtherChildren > 0 ||
    deductions.spouse.courtOrderedChildSupportPaidForOtherChildren > 0
  ) {
    push(
      "deductions",
      "Deductions",
      "Court-ordered child support actually paid for other children",
      `You: ${money(deductions.self.courtOrderedChildSupportPaidForOtherChildren)} · Spouse: ${money(
        deductions.spouse.courtOrderedChildSupportPaidForOtherChildren,
      )}`,
    );
  }
  if (
    deductions.self.spousalSupportPaidUnderPriorOrder > 0 ||
    deductions.spouse.spousalSupportPaidUnderPriorOrder > 0
  ) {
    push(
      "deductions",
      "Deductions",
      "Spousal support paid under a prior order",
      `You: ${money(deductions.self.spousalSupportPaidUnderPriorOrder)} · Spouse: ${money(
        deductions.spouse.spousalSupportPaidUnderPriorOrder,
      )}`,
    );
  }

  if (childCosts) {
    push("childCosts", "Child costs", "Monthly child-care cost", money(childCosts.childCareCostMonthly));
    push(
      "childCosts",
      "Child costs",
      "Monthly child-care amounts paid directly",
      `You: ${money(childCosts.childCarePaidBySelfMonthly)} · Other parent: ${money(
        childCosts.childCarePaidByOtherParentMonthly,
      )}`,
    );
    push(
      "childCosts",
      "Child costs",
      "Monthly children's health-insurance cost",
      money(childCosts.childrenHealthInsuranceCostMonthly),
    );
    push(
      "childCosts",
      "Child costs",
      "Monthly child health-insurance amounts paid directly",
      `You: ${money(childCosts.childHealthInsurancePaidBySelfMonthly)} · Other parent: ${money(
        childCosts.childHealthInsurancePaidByOtherParentMonthly,
      )}`,
    );
    if (childCosts.extraordinaryMedicalCostsMonthly > 0) {
      push(
        "childCosts",
        "Child costs",
        "Extraordinary medical costs (not currently supported as a separate add-on)",
        money(childCosts.extraordinaryMedicalCostsMonthly),
      );
    }
    if (childCosts.extraordinaryEducationalCostsMonthly > 0) {
      push(
        "childCosts",
        "Child costs",
        "Extraordinary educational costs (not currently supported as a separate add-on)",
        money(childCosts.extraordinaryEducationalCostsMonthly),
      );
    }
  }

  const totalHouseholdExpenses =
    householdExpenses.housingMonthly +
    householdExpenses.utilitiesMonthly +
    householdExpenses.foodMonthly +
    householdExpenses.transportationMonthly +
    householdExpenses.insuranceMonthly +
    householdExpenses.minimumDebtPaymentsMonthly +
    householdExpenses.otherMonthlyExpenses;
  push("householdExpenses", "Household expenses", "Total reported monthly household expenses", money(totalHouseholdExpenses));

  push("assetsDebts", "Assets & debts", "Marital assets (estimated value)", money(assetsDebts.maritalAssetsEstimatedValue));
  push("assetsDebts", "Assets & debts", "Marital debts (estimated value)", money(assetsDebts.maritalDebtsEstimatedValue));
  push("assetsDebts", "Assets & debts", "Other support obligations", yesNo(assetsDebts.hasOtherSupportObligations));

  push("alimonyFactors", "Alimony factors", "Requested alimony type", alimonyFactors.requestedAlimonyType);

  push("safety", "Safety & complexity", "Domestic violence or coercion reported", yesNo(safetyComplexity.domesticViolenceOrCoercion));
  push("safety", "Safety & complexity", "Jurisdiction dispute", yesNo(safetyComplexity.hasJurisdictionDispute));
  push("safety", "Safety & complexity", "Income imputed or disputed", yesNo(safetyComplexity.incomeIsImputedOrDisputed));

  push(
    "documents",
    "Document readiness",
    "Has recent pay stubs or income proof",
    yesNo(documentReadiness.hasRecentPayStubsOrIncomeProof),
  );

  return entries;
}
