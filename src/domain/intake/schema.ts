import { z } from "zod";

// The equitable-distribution enums live with the §61.075 ruleset's types.
// Importing them directly (not via the rules barrel) keeps the intake schema
// free of the rules engine's registration side effects while guaranteeing the
// intake list uses the exact same categories, classifications, owners, and
// nonmarital bases the ruleset understands.
import {
  ED_CATEGORIES,
  ED_CLASSIFICATIONS,
  ED_ITEM_TYPES,
  ED_NONMARITAL_BASES,
  ED_OWNERS,
} from "@/domain/rules/florida/equitableDistribution/types";

import {
  countSchema,
  isoDateSchema,
  longTextSchema,
  moneySchema,
  optionalIsoDateSchema,
  requiredShortTextSchema,
  shortTextSchema,
  yesNoSchema,
} from "./shared";

/**
 * Zod schemas for every topic ("step") in the guided Florida alimony intake
 * wizard. Each schema describes what a *complete* answer for that topic
 * looks like. While a person is filling out the wizard their answers are
 * stored as partial data (see `draft.ts`) — these schemas are what we run
 * against that partial data to know whether a topic is finished and, if not,
 * what's missing (see `missingData.ts`).
 */

// 1. Case basics -------------------------------------------------------------

export const caseBasicsSchema = z
  .object({
    county: requiredShortTextSchema,
    caseType: z.enum(["with_children", "without_children"], {
      message: "Choose the option that matches your case",
    }),
    petitionStatus: z.enum(["not_filed", "filed"], {
      message: "Choose the option that matches your case",
    }),
    petitionDate: isoDateSchema,
    hasAttorney: yesNoSchema,
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.petitionDate) > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["petitionDate"],
        message: "Use today's date or an earlier planning date",
      });
    }
  });

export type CaseBasics = z.infer<typeof caseBasicsSchema>;

// 2. Marriage ------------------------------------------------------------------

export const marriageSchema = z
  .object({
    marriageDate: isoDateSchema,
    separationStatus: z.enum(["living_together", "separated_no_date", "separated_with_date"], {
      message: "Choose the option that matches your situation",
    }),
    separationDate: optionalIsoDateSchema,
  })
  .superRefine((value, ctx) => {
    if (value.separationStatus === "separated_with_date" && !value.separationDate) {
      ctx.addIssue({
        code: "custom",
        path: ["separationDate"],
        message: "Enter the date you separated",
      });
    }
    if (
      value.separationDate &&
      value.marriageDate &&
      Date.parse(value.separationDate) < Date.parse(value.marriageDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["separationDate"],
        message: "Separation date can't be before the marriage date",
      });
    }
    if (value.marriageDate && Date.parse(value.marriageDate) > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["marriageDate"],
        message: "Marriage date can't be in the future",
      });
    }
  });

export type Marriage = z.infer<typeof marriageSchema>;

// 3. Spouses ---------------------------------------------------------------

export const spousesSchema = z.object({
  yourRole: z.enum(["petitioner", "respondent", "not_sure"], {
    message: "Choose the option that matches your role",
  }),
  yourNameOrInitials: requiredShortTextSchema,
  spouseNameOrInitials: requiredShortTextSchema,
});

export type Spouses = z.infer<typeof spousesSchema>;

// 4. Children -----------------------------------------------------------------

export const childSchema = z
  .object({
    id: z.string().min(1),
    nameOrInitials: requiredShortTextSchema,
    dateOfBirth: isoDateSchema,
    hasSpecialNeeds: yesNoSchema,
    specialNeedsDetails: shortTextSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.hasSpecialNeeds === "yes" && !value.specialNeedsDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["specialNeedsDetails"],
        message: "Briefly describe the special need so it isn't overlooked",
      });
    }
  });

export type Child = z.infer<typeof childSchema>;

export const childrenSchema = z
  .object({
    hasChildren: yesNoSchema,
    children: z.array(childSchema),
  })
  .superRefine((value, ctx) => {
    if (value.hasChildren === "yes" && value.children.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["children"],
        message: "Add at least one child, or change your answer above",
      });
    }
  });

export type Children = z.infer<typeof childrenSchema>;

// 5. Parenting overnights ------------------------------------------------------

export const parentingTimeSchema = z
  .object({
    overnightsWithYouPerYear: countSchema.max(366, "Enter a number of nights in a year"),
    overnightsWithOtherParentPerYear: countSchema.max(366, "Enter a number of nights in a year"),
    scheduleStatus: z.enum(["agreed", "in_dispute", "not_yet_discussed"], {
      message: "Choose the option that matches your situation",
    }),
  })
  .superRefine((value, ctx) => {
    const total = value.overnightsWithYouPerYear + value.overnightsWithOtherParentPerYear;
    if (total > 366) {
      ctx.addIssue({
        code: "custom",
        path: ["overnightsWithOtherParentPerYear"],
        message: "Total overnights for both parents can't be more than 366",
      });
    }
  });

export type ParentingTime = z.infer<typeof parentingTimeSchema>;

// 6. Gross income ---------------------------------------------------------

const personIncomeSchema = z.object({
  wages: moneySchema,
  selfEmploymentIncome: moneySchema,
  bonusesAndCommissions: moneySchema,
  investmentIncome: moneySchema,
  rentalIncome: moneySchema,
  retirementOrPensionIncome: moneySchema,
  unemploymentBenefits: moneySchema,
  disabilityBenefits: moneySchema,
  otherIncome: moneySchema,
});

export type PersonIncome = z.infer<typeof personIncomeSchema>;

export const incomeSchema = z.object({
  self: personIncomeSchema,
  spouse: personIncomeSchema,
  incomeNotes: shortTextSchema.optional(),
});

export type Income = z.infer<typeof incomeSchema>;

// 7. Allowable deductions, taxes, insurance ------------------------------------

const personDeductionsSchema = z.object({
  federalAndStateTaxWithholding: moneySchema,
  socialSecurityAndMedicareTax: moneySchema,
  mandatoryRetirementContributions: moneySchema,
  healthInsurancePremiumsForSelf: moneySchema,
  unionDues: moneySchema,
  courtOrderedChildSupportPaidForOtherChildren: moneySchema,
  spousalSupportPaidUnderPriorOrder: moneySchema,
});

export type PersonDeductions = z.infer<typeof personDeductionsSchema>;

export const deductionsSchema = z.object({
  self: personDeductionsSchema,
  spouse: personDeductionsSchema,
});

export type Deductions = z.infer<typeof deductionsSchema>;

// 8. Child care and extraordinary child costs ---------------------------------

export const childCostsSchema = z
  .object({
    childCareCostMonthly: moneySchema,
    childCarePaidBySelfMonthly: moneySchema,
    childCarePaidByOtherParentMonthly: moneySchema,
    childrenHealthInsuranceCostMonthly: moneySchema,
    childHealthInsurancePaidBySelfMonthly: moneySchema,
    childHealthInsurancePaidByOtherParentMonthly: moneySchema,
    extraordinaryMedicalCostsMonthly: moneySchema,
    extraordinaryEducationalCostsMonthly: moneySchema,
    whoUsuallyPaysChildCare: z.enum(["me", "other_parent", "split", "not_applicable"], {
      message: "Choose an option",
    }),
  })
  .superRefine((value, ctx) => {
    if (value.childCarePaidBySelfMonthly + value.childCarePaidByOtherParentMonthly > value.childCareCostMonthly) {
      ctx.addIssue({
        code: "custom",
        path: ["childCarePaidByOtherParentMonthly"],
        message: "The amounts paid cannot exceed the total monthly child-care cost",
      });
    }
    if (
      value.childHealthInsurancePaidBySelfMonthly + value.childHealthInsurancePaidByOtherParentMonthly >
      value.childrenHealthInsuranceCostMonthly
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["childHealthInsurancePaidByOtherParentMonthly"],
        message: "The amounts paid cannot exceed the total monthly child health-insurance cost",
      });
    }
  });

export type ChildCosts = z.infer<typeof childCostsSchema>;

// 9. Household expenses ---------------------------------------------------

export const householdExpensesSchema = z.object({
  housingMonthly: moneySchema,
  utilitiesMonthly: moneySchema,
  foodMonthly: moneySchema,
  transportationMonthly: moneySchema,
  insuranceMonthly: moneySchema,
  minimumDebtPaymentsMonthly: moneySchema,
  otherMonthlyExpenses: moneySchema,
});

export type HouseholdExpenses = z.infer<typeof householdExpensesSchema>;

// 10. Assets, debts, and support obligations -----------------------------------

/**
 * One itemized asset or liability the user owns or owes. Values are entered in
 * whole/fractional dollars here (the wizard collects dollars everywhere); the
 * integration mapper converts each to integer cents before it reaches the
 * §61.075 ruleset. A liability is entered as its own `type: "liability"` with a
 * positive magnitude — never as a negative asset — to match the ruleset.
 */
export const assetDebtItemSchema = z
  .object({
    id: z.string().min(1),
    label: requiredShortTextSchema,
    category: z.enum(ED_CATEGORIES),
    type: z.enum(ED_ITEM_TYPES),
    /** Non-negative dollar amount. Blank is treated as $0. */
    value: moneySchema,
    classification: z.enum(ED_CLASSIFICATIONS),
    /** Only meaningful when `classification === "nonmarital"`. */
    nonmaritalBasis: z.enum(ED_NONMARITAL_BASES).optional(),
    owner: z.enum(ED_OWNERS),
    /**
     * The parties agree in a written agreement to exclude this item from the
     * marital estate (Fla. Stat. §61.075(6)(b)4). Only honored downstream when
     * the step-level `writtenAgreementConfirmed` flag is also true.
     */
    excludedByWrittenAgreement: z.boolean().default(false),
    /**
     * Separate property that was mixed with marital money or effort — e.g.
     * premarital savings moved into a joint account. Only meaningful when
     * `classification === "nonmarital"`; downstream this escalates to
     * professional review because the split depends on tracing.
     */
    commingledWithMaritalFunds: z.boolean().default(false),
  })
  .superRefine((item, ctx) => {
    if (item.commingledWithMaritalFunds && item.classification !== "nonmarital") {
      ctx.addIssue({
        code: "custom",
        path: ["commingledWithMaritalFunds"],
        message: "Only separate property can be marked as mixed with marital money",
      });
    }
    if (item.classification === "nonmarital" && !item.nonmaritalBasis) {
      ctx.addIssue({
        code: "custom",
        path: ["nonmaritalBasis"],
        message: "Choose why this item is separate (nonmarital) property",
      });
    }
    // Separate (nonmarital) property is already set apart, so it cannot also be
    // "excluded from the marital estate" — mirrors the ruleset's own rule.
    if (item.excludedByWrittenAgreement && item.classification === "nonmarital") {
      ctx.addIssue({
        code: "custom",
        path: ["excludedByWrittenAgreement"],
        message: "Separate property is already set aside — it can't also be excluded by agreement",
      });
    }
  });

export type AssetDebtItem = z.infer<typeof assetDebtItemSchema>;

/**
 * Optional home-equity worksheet. Purely a helper for working out what to enter
 * as the home's value and the mortgage balance, plus an optional forward
 * projection. The projection NEVER feeds the marital estate — Florida values
 * the estate at the §61.075(7) cut-off date — so it is stored separately from
 * `items` and surfaced as a planning scenario.
 */
export const homeEquityWorksheetSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Present-day fair market value. */
    marketValue: moneySchema.optional(),
    /** Present-day mortgage payoff balance, entered positive. */
    mortgageBalance: moneySchema.optional(),
    /** Estimated selling costs as a percent of the sale price. */
    costOfSalePercent: z.coerce.number().min(0).max(100).optional(),
    /** Principal the scheduled payments retire each year. */
    annualPrincipalPaydown: moneySchema.optional(),
    /** The user's own growth estimate, percent per year. No default: none is authoritative. */
    annualGrowthPercent: z.coerce.number().min(-20).max(20).optional(),
    growthBasis: z.enum(["propertyValue", "equity"]).default("propertyValue"),
    projectionYears: z.coerce.number().int().min(0).max(30).default(5),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return;
    if (value.marketValue === undefined) {
      ctx.addIssue({ code: "custom", path: ["marketValue"], message: "Enter what the home is worth today" });
    }
    if (value.mortgageBalance === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["mortgageBalance"],
        message: "Enter the mortgage payoff balance (enter 0 if it is paid off)",
      });
    }
    // A projection with no rate would silently become a 0% forecast that looks
    // like a considered answer, so require the number rather than assuming one.
    if (value.projectionYears > 0 && value.annualGrowthPercent === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["annualGrowthPercent"],
        message: "Enter your estimated yearly growth, or set the projection to 0 years",
      });
    }
  });

export type HomeEquityWorksheet = z.infer<typeof homeEquityWorksheetSchema>;

export const assetsDebtsSchema = z
  .object({
    /** Itemized assets and liabilities used for the §61.075 equitable-distribution estimate. */
    items: z.array(assetDebtItemSchema).default([]),
    /** Optional helper for working out home equity. Never feeds the estate directly. */
    homeEquity: homeEquityWorksheetSchema.default({ enabled: false, growthBasis: "propertyValue", projectionYears: 5 }),
    /**
     * Whether a valid written agreement of the parties actually exists to
     * support any items flagged `excludedByWrittenAgreement`. Without it, the
     * ruleset does not honor the exclusions and raises a blocking flag.
     * §61.075(6)(b)4.
     */
    writtenAgreementConfirmed: z.boolean().default(false),
    /** A party asks the court for an UNEQUAL (non-50/50) distribution. */
    unequalDistributionRequested: z.boolean().default(false),
    /** A claim of intentional dissipation/waste of marital assets is present. §61.075(1)(i). */
    dissipationClaimPresent: z.boolean().default(false),
    /** A claim that marital funds paid down a mortgage on nonmarital real property. §61.075(6)(a)1.c. */
    nonmaritalMortgagePaydownClaimPresent: z.boolean().default(false),
    // --- Legacy summary fields (optional; superseded by the itemized list) ---
    // Kept optional so older saved drafts still validate and so any code that
    // still reads a rough total keeps working. New drafts derive totals from
    // `items` instead of asking for these.
    maritalAssetsSummary: longTextSchema.optional(),
    maritalAssetsEstimatedValue: moneySchema.optional(),
    maritalDebtsSummary: longTextSchema.optional(),
    maritalDebtsEstimatedValue: moneySchema.optional(),
    hasOtherSupportObligations: yesNoSchema,
    otherSupportObligationsDetails: shortTextSchema.optional(),
    hasHiddenOrUnknownAssets: yesNoSchema,
    hasComplexBusinessInterests: yesNoSchema,
  })
  .superRefine((value, ctx) => {
    if (value.hasOtherSupportObligations === "yes" && !value.otherSupportObligationsDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["otherSupportObligationsDetails"],
        message: "Briefly describe the other support obligation",
      });
    }
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "Each item needs a unique id",
        });
      }
      seen.add(item.id);
    });
  });

export type AssetsDebts = z.infer<typeof assetsDebtsSchema>;

// 11. Alimony need/ability and section 61.08 factors ---------------------------

export const alimonyFactorsSchema = z
  .object({
    standardOfLivingDuringMarriage: longTextSchema.min(
      1,
      "Tell us briefly about your household's standard of living",
    ),
    ageAndHealthSelf: longTextSchema.min(1, "Tell us briefly about your age and health"),
    ageAndHealthSpouse: longTextSchema.min(1, "Tell us briefly about your spouse's age and health"),
    earningCapacitySelf: longTextSchema.min(1, "Tell us briefly about your ability to earn income"),
    earningCapacitySpouse: longTextSchema.min(1, "Tell us briefly about your spouse's ability to earn income"),
    contributionsToMarriage: longTextSchema.min(
      1,
      "Tell us briefly about contributions like homemaking, child-rearing, or supporting a spouse's career or education",
    ),
    otherFactors: longTextSchema.optional(),
    potentialAlimonyRecipient: z.enum(["self", "spouse", "not_sure", "none"], {
      message: "Choose who may receive alimony",
    }),
    confirmedReasonableMonthlyNeed: moneySchema,
    rehabilitativePlanConfirmed: yesNoSchema,
    exceptionalCircumstancesExtensionRequested: yesNoSchema,
    requestedAlimonyType: z.enum(
      ["not_sure", "bridge_the_gap", "rehabilitative", "durational", "permanent", "none"],
      { message: "Choose the option closest to what you're looking for" },
    ),
  })
  .superRefine((value, ctx) => {
    if (value.requestedAlimonyType === "none" && value.potentialAlimonyRecipient !== "none") {
      ctx.addIssue({
        code: "custom",
        path: ["potentialAlimonyRecipient"],
        message: "Choose 'No alimony requested' here too, or select an alimony type",
      });
    }
    if (value.potentialAlimonyRecipient === "none" && value.requestedAlimonyType !== "none") {
      ctx.addIssue({
        code: "custom",
        path: ["requestedAlimonyType"],
        message: "Choose 'I'm not requesting alimony,' or identify a potential recipient",
      });
    }
  });

export type AlimonyFactors = z.infer<typeof alimonyFactorsSchema>;

// 12. Safety and complexity flags ----------------------------------------------

export const safetyComplexitySchema = z
  .object({
    domesticViolenceOrCoercion: yesNoSchema,
    feelsSafeToContinueOnline: yesNoSchema.optional(),
    hasJurisdictionDispute: yesNoSchema,
    incomeIsImputedOrDisputed: yesNoSchema,
    filedOrFilingBeforeJuly2023: yesNoSchema,
    otherComplexityNotes: shortTextSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.domesticViolenceOrCoercion === "yes" && !value.feelsSafeToContinueOnline) {
      ctx.addIssue({
        code: "custom",
        path: ["feelsSafeToContinueOnline"],
        message: "Let us know if it's safe for you to keep using this tool right now",
      });
    }
  });

export type SafetyComplexity = z.infer<typeof safetyComplexitySchema>;

// 13. Document readiness -------------------------------------------------------

export const documentReadinessSchema = z.object({
  hasRecentPayStubsOrIncomeProof: yesNoSchema,
  hasTaxReturnsLastThreeYears: yesNoSchema,
  hasBankAndAssetStatements: yesNoSchema,
  hasParentingOrTimeshareRecords: z.enum(["yes", "no", "not_applicable"], {
    message: "Choose an option",
  }),
  acknowledgesSevenDayRetention: z
    .boolean()
    .refine((value) => value === true, { message: "Please confirm you understand before continuing" }),
});

export type DocumentReadiness = z.infer<typeof documentReadinessSchema>;
