import { sumGrossIncomeDollars } from "@/domain/integration";
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

  // Uses the same gross-income definition the calculators use, rather than
  // re-adding the categories here. A second copy of this sum could drift from
  // §61.30(2)(a) and make the packet disagree with its own figures.
  const selfGross = sumGrossIncomeDollars(income.self);
  const spouseGross = sumGrossIncomeDollars(income.spouse);

  push("income", "Gross income", "Your total monthly gross income", money(selfGross));
  push("income", "Gross income", "Your spouse's total monthly gross income", money(spouseGross));

  // Variable pay is broken out separately: these are the categories most often
  // missed or misread, and a reviewer needs to see what was counted.
  for (const [who, person] of [["Your", income.self], ["Your spouse's", income.spouse]] as const) {
    if (person.bonusesAndCommissions > 0) {
      push("income", "Gross income", `${who} bonuses and commissions (counted, §61.30(2)(a)2.)`, money(person.bonusesAndCommissions));
    }
    if (person.equityCompensation > 0) {
      push("income", "Gross income", `${who} vesting equity/RSU compensation (counted, §61.30(2)(a)2.)`, money(person.equityCompensation));
    }
    if (person.recurringCapitalGains > 0) {
      push("income", "Gross income", `${who} recurring gains from property (counted, §61.30(2)(a)14.)`, money(person.recurringCapitalGains));
    }
    if (person.nonrecurringGains > 0) {
      push(
        "income",
        "Gross income",
        `${who} nonrecurring gains (NOT counted as income, §61.30(2)(a)14.)`,
        money(person.nonrecurringGains),
      );
    }
  }
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

  const maritalItems = assetsDebts.items.filter(
    (item) => item.classification === "marital" || item.classification === "presumedMarital",
  );
  const maritalAssetTotal = maritalItems
    .filter((item) => item.type === "asset")
    .reduce((sum, item) => sum + item.value, 0);
  const maritalDebtTotal = maritalItems
    .filter((item) => item.type === "liability")
    .reduce((sum, item) => sum + item.value, 0);
  const nonmaritalCount = assetsDebts.items.filter((item) => item.classification === "nonmarital").length;
  const excludedCount = assetsDebts.items.filter((item) => item.excludedByWrittenAgreement).length;

  push("assetsDebts", "Assets & debts", "Itemized assets and debts entered", String(assetsDebts.items.length));
  push("assetsDebts", "Assets & debts", "Marital assets (sum of itemized values)", money(maritalAssetTotal));
  push("assetsDebts", "Assets & debts", "Marital debts (sum of itemized values)", money(maritalDebtTotal));
  if (nonmaritalCount > 0) {
    push("assetsDebts", "Assets & debts", "Items marked separate (nonmarital) property", String(nonmaritalCount));
  }
  if (excludedCount > 0) {
    push(
      "assetsDebts",
      "Assets & debts",
      "Items flagged excluded by written agreement",
      `${excludedCount} (written agreement ${assetsDebts.writtenAgreementConfirmed ? "confirmed" : "not confirmed"})`,
    );
  }
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
