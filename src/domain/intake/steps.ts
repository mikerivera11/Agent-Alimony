import type { ZodType } from "zod";

import {
  alimonyFactorsSchema,
  assetsDebtsSchema,
  caseBasicsSchema,
  childCostsSchema,
  childrenSchema,
  deductionsSchema,
  documentReadinessSchema,
  householdExpensesSchema,
  incomeSchema,
  marriageSchema,
  parentingTimeSchema,
  safetyComplexitySchema,
  spousesSchema,
  type AlimonyFactors,
  type AssetsDebts,
  type CaseBasics,
  type ChildCosts,
  type Children,
  type Deductions,
  type DocumentReadiness,
  type HouseholdExpenses,
  type Income,
  type Marriage,
  type ParentingTime,
  type SafetyComplexity,
  type Spouses,
} from "./schema";
import type { IntakeDraftData, IntakeStepId } from "./draft";

/** Ordered list of every topic in the wizard — this order is what the person sees. */
export const INTAKE_STEP_ORDER: IntakeStepId[] = [
  "caseBasics",
  "marriage",
  "spouses",
  "children",
  "parentingTime",
  "income",
  "deductions",
  "childCosts",
  "householdExpenses",
  "assetsDebts",
  "alimonyFactors",
  "safetyComplexity",
  "documentReadiness",
];

export interface IntakeStepConfig<T> {
  id: IntakeStepId;
  /** Plain-language topic title shown in the progress list and step heading. */
  title: string;
  /** One short sentence describing the topic, shown under the heading. */
  summary: string;
  /** Plain-language explanation of why this information is requested. */
  whyWeAsk: string;
  schema: ZodType<T>;
  defaultValues: T;
  /** Whether this topic applies given what's known so far (e.g. no children = skip parenting time). */
  isApplicable: (data: IntakeDraftData) => boolean;
}

const alwaysApplicable = () => true;
const hasChildren = (data: IntakeDraftData) => data.children.hasChildren === "yes";

const emptyPersonIncome: Income["self"] = {
  wages: 0,
  selfEmploymentIncome: 0,
  bonusesAndCommissions: 0,
  investmentIncome: 0,
  rentalIncome: 0,
  retirementOrPensionIncome: 0,
  unemploymentBenefits: 0,
  disabilityBenefits: 0,
  otherIncome: 0,
};

const emptyPersonDeductions: Deductions["self"] = {
  federalAndStateTaxWithholding: 0,
  socialSecurityAndMedicareTax: 0,
  mandatoryRetirementContributions: 0,
  healthInsurancePremiumsForSelf: 0,
  unionDues: 0,
  courtOrderedChildSupportPaidForOtherChildren: 0,
  spousalSupportPaidUnderPriorOrder: 0,
};

export const INTAKE_STEPS: { [K in IntakeStepId]: IntakeStepConfig<IntakeDraftData[K] extends Partial<infer U> ? U : never> } = {
  caseBasics: {
    id: "caseBasics",
    title: "Case basics",
    summary: "Where your case is filed and what kind of case this is.",
    whyWeAsk:
      "We ask for your county and case type because Florida alimony guidance and forms vary depending on where you filed and whether children are involved.",
    schema: caseBasicsSchema,
    defaultValues: {
      county: "",
      caseType: "without_children",
      petitionStatus: "not_filed",
      petitionDate: "",
      hasAttorney: "no",
    } satisfies CaseBasics,
    isApplicable: alwaysApplicable,
  },
  marriage: {
    id: "marriage",
    title: "Your marriage",
    summary: "When you married and, if applicable, when you separated.",
    whyWeAsk:
      "The length of a marriage is one of the main things Florida law looks at when weighing alimony, so dates matter more than details.",
    schema: marriageSchema,
    defaultValues: {
      marriageDate: "",
      separationStatus: "living_together",
      separationDate: undefined,
    } satisfies Marriage,
    isApplicable: alwaysApplicable,
  },
  spouses: {
    id: "spouses",
    title: "You and your spouse",
    summary: "Basic identifying information for both spouses.",
    whyWeAsk:
      "Initials are enough for this preview — we only need to tell 'you' and 'your spouse' apart on the forms and summaries.",
    schema: spousesSchema,
    defaultValues: {
      yourRole: "not_sure",
      yourNameOrInitials: "",
      spouseNameOrInitials: "",
    } satisfies Spouses,
    isApplicable: alwaysApplicable,
  },
  children: {
    id: "children",
    title: "Children",
    summary: "Whether you and your spouse have shared minor children.",
    whyWeAsk:
      "Alimony and child support interact under Florida law, so we ask about children before asking about parenting time or child-related costs.",
    schema: childrenSchema,
    defaultValues: {
      hasChildren: "no",
      children: [],
    } satisfies Children,
    isApplicable: alwaysApplicable,
  },
  parentingTime: {
    id: "parentingTime",
    title: "Parenting time",
    summary: "How overnights are, or will be, shared between parents.",
    whyWeAsk:
      "Overnights affect child support calculations, which in turn affect how much may be available for alimony.",
    schema: parentingTimeSchema,
    defaultValues: {
      overnightsWithYouPerYear: 0,
      overnightsWithOtherParentPerYear: 0,
      scheduleStatus: "not_yet_discussed",
    } satisfies ParentingTime,
    isApplicable: hasChildren,
  },
  income: {
    id: "income",
    title: "Gross income",
    summary: "Income for you and your spouse, before taxes, by category.",
    whyWeAsk:
      "Section 61.08 of Florida law looks at each spouse's financial resources — listing income by category keeps nothing hidden by accident.",
    schema: incomeSchema,
    defaultValues: {
      self: { ...emptyPersonIncome },
      spouse: { ...emptyPersonIncome },
      incomeNotes: "",
    } satisfies Income,
    isApplicable: alwaysApplicable,
  },
  deductions: {
    id: "deductions",
    title: "Deductions, taxes, and insurance",
    summary: "Amounts regularly withheld or paid out of income.",
    whyWeAsk:
      "Alimony estimates are based on take-home resources, not gross pay, so these amounts help estimate what's actually available.",
    schema: deductionsSchema,
    defaultValues: {
      self: { ...emptyPersonDeductions },
      spouse: { ...emptyPersonDeductions },
    } satisfies Deductions,
    isApplicable: alwaysApplicable,
  },
  childCosts: {
    id: "childCosts",
    title: "Child care and extra child costs",
    summary: "Day care, health coverage, and any unusual child expenses.",
    whyWeAsk:
      "Child-related costs are treated separately from a parent's own household expenses in Florida support calculations.",
    schema: childCostsSchema,
    defaultValues: {
      childCareCostMonthly: 0,
      childCarePaidBySelfMonthly: 0,
      childCarePaidByOtherParentMonthly: 0,
      childrenHealthInsuranceCostMonthly: 0,
      childHealthInsurancePaidBySelfMonthly: 0,
      childHealthInsurancePaidByOtherParentMonthly: 0,
      extraordinaryMedicalCostsMonthly: 0,
      extraordinaryEducationalCostsMonthly: 0,
      whoUsuallyPaysChildCare: "not_applicable",
    } satisfies ChildCosts,
    isApplicable: hasChildren,
  },
  householdExpenses: {
    id: "householdExpenses",
    title: "Household expenses",
    summary: "Your typical monthly cost of living.",
    whyWeAsk:
      "Comparing income to reasonable monthly needs is central to Florida's alimony 'need and ability to pay' standard.",
    schema: householdExpensesSchema,
    defaultValues: {
      housingMonthly: 0,
      utilitiesMonthly: 0,
      foodMonthly: 0,
      transportationMonthly: 0,
      insuranceMonthly: 0,
      minimumDebtPaymentsMonthly: 0,
      otherMonthlyExpenses: 0,
    } satisfies HouseholdExpenses,
    isApplicable: alwaysApplicable,
  },
  assetsDebts: {
    id: "assetsDebts",
    title: "Assets, debts, and support obligations",
    summary: "A rough picture of what you own, owe, and already pay.",
    whyWeAsk:
      "Courts consider each spouse's assets and debts, and any support already owed elsewhere, when deciding alimony.",
    schema: assetsDebtsSchema,
    defaultValues: {
      items: [],
      writtenAgreementConfirmed: false,
      unequalDistributionRequested: false,
      dissipationClaimPresent: false,
      nonmaritalMortgagePaydownClaimPresent: false,
      hasOtherSupportObligations: "no",
      otherSupportObligationsDetails: "",
      hasHiddenOrUnknownAssets: "no",
      hasComplexBusinessInterests: "no",
    } satisfies AssetsDebts,
    isApplicable: alwaysApplicable,
  },
  alimonyFactors: {
    id: "alimonyFactors",
    title: "Need, ability to pay, and other factors",
    summary: "The plain-language version of the factors Florida judges weigh.",
    whyWeAsk:
      "Florida Statute 61.08 lists specific factors — standard of living, age and health, earning ability, and contributions to the marriage among them — that guide alimony decisions.",
    schema: alimonyFactorsSchema,
    defaultValues: {
      standardOfLivingDuringMarriage: "",
      ageAndHealthSelf: "",
      ageAndHealthSpouse: "",
      earningCapacitySelf: "",
      earningCapacitySpouse: "",
      contributionsToMarriage: "",
      otherFactors: "",
      potentialAlimonyRecipient: "not_sure",
      confirmedReasonableMonthlyNeed: 0,
      rehabilitativePlanConfirmed: "no",
      exceptionalCircumstancesExtensionRequested: "no",
      requestedAlimonyType: "not_sure",
    } satisfies AlimonyFactors,
    isApplicable: alwaysApplicable,
  },
  safetyComplexity: {
    id: "safetyComplexity",
    title: "Safety and complexity check",
    summary: "A few questions to flag situations that need extra care.",
    whyWeAsk:
      "Some situations — like safety concerns or disputes about income — go beyond what a self-help tool like this can safely estimate.",
    schema: safetyComplexitySchema,
    defaultValues: {
      domesticViolenceOrCoercion: "no",
      feelsSafeToContinueOnline: undefined,
      hasJurisdictionDispute: "no",
      incomeIsImputedOrDisputed: "no",
      filedOrFilingBeforeJuly2023: "no",
      otherComplexityNotes: "",
    } satisfies SafetyComplexity,
    isApplicable: alwaysApplicable,
  },
  documentReadiness: {
    id: "documentReadiness",
    title: "Document readiness",
    summary: "A checklist of paperwork you'll likely want on hand.",
    whyWeAsk:
      "Knowing what's gathered — and what's missing — helps you finish your case without last-minute scrambling.",
    schema: documentReadinessSchema,
    defaultValues: {
      hasRecentPayStubsOrIncomeProof: "no",
      hasTaxReturnsLastThreeYears: "no",
      hasBankAndAssetStatements: "no",
      hasParentingOrTimeshareRecords: "not_applicable",
      acknowledgesSevenDayRetention: false,
    } satisfies DocumentReadiness,
    isApplicable: alwaysApplicable,
  },
};

export function getApplicableStepIds(data: IntakeDraftData): IntakeStepId[] {
  return INTAKE_STEP_ORDER.filter((id) => INTAKE_STEPS[id].isApplicable(data));
}
