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
  addedMoneySchema,
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

// 5b. Parenting plan ----------------------------------------------------------

export const holidayScheduleItemSchema = z.object({
  id: z.string().min(1),
  // Empty retained rows are harmless outside "specific" mode and are validated
  // by the parent schema when the rows actually control the schedule.
  name: shortTextSchema,
  /**
   * A compact, internally-consistent version of Form 12.995(a)'s Even Years,
   * Odd Years, and Every Year columns. "Alternating" stores who receives odd
   * years; the other parent necessarily receives even years.
   */
  rotation: z.enum([
    "alternating",
    "you_every_year",
    "other_parent_every_year",
    "regular_schedule",
    "undecided",
  ]),
  oddYearParent: z.enum(["you", "other_parent"]).optional(),
  beginEndTime: shortTextSchema.optional(),
  notes: longTextSchema.optional(),
});

export type HolidayScheduleItem = z.infer<typeof holidayScheduleItemSchema>;

/**
 * Proposed defaults, not legal defaults. Form 12.995(a) leaves the assignments
 * and times blank for the parents/court to decide. These merely make the
 * alternating-year pattern the user requested concrete and reviewable.
 *
 * Christmas is opposite Thanksgiving so one parent does not receive both in
 * the same year. New Year's Day alternates independently.
 */
export const DEFAULT_HOLIDAY_SCHEDULES: readonly HolidayScheduleItem[] = [
  {
    id: "major-thanksgiving",
    name: "Thanksgiving",
    rotation: "alternating",
    oddYearParent: "you",
    beginEndTime: "",
    notes: "",
  },
  {
    id: "major-christmas",
    name: "Christmas",
    rotation: "alternating",
    oddYearParent: "other_parent",
    beginEndTime: "",
    notes: "",
  },
  {
    id: "major-new-years",
    name: "New Year's Day",
    rotation: "alternating",
    oddYearParent: "you",
    beginEndTime: "",
    notes: "",
  },
] as const;

/**
 * The substantive terms a Florida parenting plan has to settle. §61.13(2)(b)
 * requires a parenting plan in every case involving a minor child, and
 * requires it to describe how the parents will share daily tasks, the
 * time-sharing schedule, who is responsible for health care and school-related
 * matters, and the methods of communication with the child.
 *
 * These are choices, not facts that can be derived from the financial intake,
 * which is why they are collected rather than inferred. Everything here is
 * optional at the field level so a person can record what they have decided
 * and leave the rest open; a half-decided plan is the normal state, and
 * forcing a guess would put an unconsidered term in front of a judge.
 */
export const parentingPlanSchema = z
  .object({
    planStatus: z.enum(["agreed", "proposed", "in_dispute"], {
      message: "Choose the option that matches your situation",
    }),
    /** §61.13(2)(b)3: school-designation and other addresses. */
    schoolDesignationParent: z.enum(["you", "other_parent", "undecided"], {
      message: "Choose who the plan designates",
    }),
    /** §61.13(2)(b): shared vs sole parental responsibility for major decisions. */
    decisionMakingEducation: z.enum(["shared", "you", "other_parent", "undecided"]),
    decisionMakingHealthcare: z.enum(["shared", "you", "other_parent", "undecided"]),
    decisionMakingReligion: z.enum(["shared", "you", "other_parent", "undecided"]),
    weekdaySchedule: longTextSchema.optional(),
    weekendSchedule: longTextSchema.optional(),
    /**
     * Retained for legacy drafts and for winter/spring breaks or other schedule
     * notes that do not belong to one named holiday row.
     */
    holidaySchedule: longTextSchema.optional(),
    // Optional only for drafts reviewed before the structured builder existed.
    // New drafts receive "specific" from the step defaults.
    holidayScheduleMode: z.enum(["regular_schedule", "as_agreed", "specific"]).optional(),
    holidayScheduleOverridesRegular: z.boolean().default(true),
    holidaySchedules: z.array(holidayScheduleItemSchema).max(30, "Add no more than 30 holiday rows").default([]),
    threeWeekendAdjustment: z.boolean().default(false),
    unspecifiedHolidayFollowsAdjacentWeekend: z.boolean().default(false),
    summerSchedule: longTextSchema.optional(),
    exchangeArrangements: longTextSchema.optional(),
    communicationBetweenChildAndParent: longTextSchema.optional(),
    /** §61.13001 relocation is a distinct statutory process; flagged, never advised on. */
    relocationAnticipated: yesNoSchema,
  })
  .superRefine((value, ctx) => {
    if (value.holidayScheduleMode !== "specific") return;

    const ids = new Set<string>();
    value.holidaySchedules.forEach((holiday, index) => {
      if (ids.has(holiday.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["holidaySchedules", index, "id"],
          message: "Each holiday needs a unique identifier",
        });
      }
      ids.add(holiday.id);
      if (!holiday.name.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["holidaySchedules", index, "name"],
          message: "Enter a holiday or special-day name",
        });
      }
      if (holiday.rotation === "alternating" && holiday.oddYearParent === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["holidaySchedules", index, "oddYearParent"],
          message: "Choose which parent has this holiday in odd-numbered years",
        });
      }
    });
    if (value.holidaySchedules.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["holidaySchedules"],
        message: "Add at least one holiday, or choose the regular schedule",
      });
    }
  });

export type ParentingPlan = z.infer<typeof parentingPlanSchema>;

// 5c. Parenting plan form details --------------------------------------------

const parentChoiceSchema = z.enum(["you", "other_parent", "undecided"]);
const percentageSchema = z.coerce.number().min(0).max(100);

export const parentingPlanDetailsSchema = z
  .object({
    planOrderType: z.enum(["final", "temporary", "modification"]),
    petitionerAddressStatus: z.enum(["known", "unknown", "confidential"]),
    respondentAddressStatus: z.enum(["known", "unknown", "confidential"]),
    extracurricularApproval: z.enum(["either_parent", "mutual_agreement", "other"]),
    extracurricularTransportation: z.enum(["parent_with_child", "other"]),
    extracurricularCosts: shortTextSchema,
    extracurricularActivityCostPercentSelf: percentageSchema.default(50),
    extracurricularEquipmentCostPercentSelf: percentageSchema.default(50),
    informationSharingOther: longTextSchema.optional(),
    schoolCalendarBasis: z.enum(["oldest_child", "youngest_child", "county", "school"]),
    schoolCalendarDetails: shortTextSchema.optional(),
    scheduleChangeNotice: shortTextSchema,
    scheduleChangeRequesterPaysCosts: yesNoSchema,
    scheduleChangeOther: longTextSchema.optional(),
    scheduleStartDate: isoDateSchema,
    differentChildSchedule: yesNoSchema,
    differentChildScheduleDetails: longTextSchema.optional(),
    winterBreakMode: z.enum(["split", "alternating_entire_break", "other"]),
    winterBreakDetails: longTextSchema,
    springBreakMode: z.enum(["regular_schedule", "alternating", "one_parent", "even_split", "other"]),
    springBreakParent: parentChoiceSchema.optional(),
    springBreakDetails: longTextSchema,
    summerBreakMode: z.enum(["regular_schedule", "one_parent", "equal_split", "other"]),
    summerBreakParent: parentChoiceSchema.optional(),
    summerBreakDetails: longTextSchema,
    transportationMode: z.enum(["you", "other_parent", "beginning_parent", "ending_parent", "other"]),
    transportationDetails: longTextSchema.optional(),
    lateExchangeMinutes: countSchema.max(240),
    exchangeLocationMode: z.enum(["parents_homes", "specific_location", "other"]),
    exchangeLocationDetails: longTextSchema.optional(),
    transportationCostsMode: z.enum(["child_support_order", "split", "other"]),
    transportationCostsDetails: longTextSchema.optional(),
    domesticTravelNoticeDays: countSchema.max(365),
    internationalTravelNoticeDays: countSchema.max(365),
    internationalTravelSecurity: longTextSchema.optional(),
    travelOther: longTextSchema.optional(),
    majorityDesignationParent: parentChoiceSchema,
    parentCommunicationMethods: z
      .array(z.enum(["in_person", "telephone", "letter", "email", "other"]))
      .min(1, "Choose at least one way the parents will communicate"),
    parentCommunicationOther: shortTextSchema.optional(),
    childCommunicationMethods: z
      .array(z.enum(["telephone", "email", "video", "other"]))
      .min(1, "Choose at least one way the child may communicate"),
    childCommunicationMode: z.enum(["anytime", "daily", "specific_days", "other"]),
    childCommunicationDetails: longTextSchema,
    electronicCommunicationCosts: longTextSchema,
    childcareMode: z.enum(["each_parent_selects", "mutual_agreement", "right_of_first_refusal", "other"]),
    rightOfFirstRefusalHours: countSchema.max(168),
    childcareDetails: longTextSchema.optional(),
    disputeResolution: longTextSchema,
    otherProvisions: longTextSchema.optional(),
  })
  .superRefine((value, ctx) => {
    for (const [field, label] of [
      ["schoolCalendarDetails", "Enter the county or school calendar"] as const,
      ["differentChildScheduleDetails", "Describe the different schedule"] as const,
      ["transportationDetails", "Describe the transportation arrangement"] as const,
      ["exchangeLocationDetails", "Enter the exchange location"] as const,
      ["transportationCostsDetails", "Describe how transportation costs are divided"] as const,
      ["parentCommunicationOther", "Describe the other communication method"] as const,
      ["childcareDetails", "Describe the child-care arrangement"] as const,
    ]) {
      const needsValue =
        (field === "schoolCalendarDetails" &&
          (value.schoolCalendarBasis === "county" || value.schoolCalendarBasis === "school")) ||
        (field === "differentChildScheduleDetails" && value.differentChildSchedule === "yes") ||
        (field === "transportationDetails" && value.transportationMode === "other") ||
        (field === "exchangeLocationDetails" && value.exchangeLocationMode !== "parents_homes") ||
        (field === "transportationCostsDetails" && value.transportationCostsMode !== "child_support_order") ||
        (field === "parentCommunicationOther" && value.parentCommunicationMethods.includes("other")) ||
        (field === "childcareDetails" && value.childcareMode === "other");
      if (needsValue && !value[field]?.trim()) {
        ctx.addIssue({ code: "custom", path: [field], message: label });
      }
    }
    if (value.childcareMode === "right_of_first_refusal" && value.rightOfFirstRefusalHours <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rightOfFirstRefusalHours"],
        message: "Enter the number of hours that triggers the offer to the other parent",
      });
    }
  });

export type ParentingPlanDetails = z.infer<typeof parentingPlanDetailsSchema>;

// 6. Gross income ---------------------------------------------------------

/**
 * Gross income categories, tracking Fla. Stat. §61.30(2)(a).
 *
 * Variable pay is split into several fields rather than collected as one
 * "investment income" figure because §61.30(2)(a) does not treat these alike:
 * bonuses and commissions are income under (2)(a)2, interest and dividends
 * under (2)(a)10, but gains from dealings in property under (2)(a)14 count
 * *only if they recur*. Collapsing them into one box silently counts a
 * one-time stock sale that the statute excludes.
 *
 * Every figure is monthly because §61.30(2) requires income to be determined
 * on a monthly basis. Converting lumpy annual pay to a monthly figure is an
 * input aid in the UI, not a rule — see `AnnualisedMoneyField`.
 */
const personIncomeSchema = z.object({
  wages: moneySchema,
  selfEmploymentIncome: moneySchema,
  bonusesAndCommissions: moneySchema,
  /** RSUs and other equity that vests as compensation for work. §61.30(2)(a)2. */
  equityCompensation: addedMoneySchema,
  /** Interest and dividends. §61.30(2)(a)10. */
  investmentIncome: moneySchema,
  /** Gains from selling property/stock that recur. §61.30(2)(a)14. */
  recurringCapitalGains: addedMoneySchema,
  /**
   * Gains that do *not* recur. Deliberately excluded from gross income by
   * §61.30(2)(a)14, but still collected: under §61.30(13) a court may order
   * support paid out of nonrecurring income where recurring income cannot
   * meet the child's needs.
   */
  nonrecurringGains: addedMoneySchema,
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
    /** Current required monthly payment for a liability; ignored for assets. */
    monthlyPayment: moneySchema.default(0),
    classification: z.enum(ED_CLASSIFICATIONS),
    /** Only meaningful when `classification === "nonmarital"`. */
    nonmaritalBasis: z.enum(ED_NONMARITAL_BASES).optional(),
    owner: z.enum(ED_OWNERS),
    /**
     * The parties' reported settlement assignment for this item. This is
     * drafting input for the attorney packet only; it never changes the
     * deterministic §61.075 classification or equal-distribution baseline.
     */
    agreedRecipient: z
      .enum(["not_agreed", "you", "spouse", "joint", "sell_and_divide"])
      .default("not_agreed"),
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
    if (item.type === "liability" && item.agreedRecipient === "sell_and_divide") {
      ctx.addIssue({
        code: "custom",
        path: ["agreedRecipient"],
        message: "A debt cannot be sold and divided",
      });
    }
    if (item.type === "asset" && item.monthlyPayment > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyPayment"],
        message: "Monthly payment applies only to debts",
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
    alimonyAgreementStatus: z
      .enum(["agreed_payment", "agreed_waiver", "not_agreed"], {
        message: "Choose whether you and your spouse have agreed on alimony",
      })
      .default("not_agreed"),
    agreedAlimonyType: z
      .enum(["bridge_the_gap", "rehabilitative", "durational", "lump_sum", "other"])
      .optional(),
    agreedAlimonyAmount: addedMoneySchema,
    agreedAlimonyFrequency: z
      .enum(["weekly", "every_two_weeks", "twice_monthly", "monthly", "one_time", "other"])
      .optional(),
    agreedAlimonyStartDate: optionalIsoDateSchema,
    agreedAlimonyEndCondition: shortTextSchema.optional(),
    agreedAlimonyModifiability: z.enum(["modifiable", "nonmodifiable", "attorney_to_confirm"]).optional(),
    agreedAlimonyPaymentMethod: z
      .enum(["direct", "state_disbursement_unit", "income_withholding", "other", "attorney_to_confirm"])
      .optional(),
    agreedAlimonySecurity: z
      .enum(["none", "life_insurance", "other", "attorney_to_confirm"])
      .optional(),
    agreedAlimonyNotes: longTextSchema.optional(),
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
    if (value.alimonyAgreementStatus === "agreed_payment") {
      if (value.potentialAlimonyRecipient === "none" || value.potentialAlimonyRecipient === "not_sure") {
        ctx.addIssue({
          code: "custom",
          path: ["potentialAlimonyRecipient"],
          message: "Identify who will receive the agreed alimony payment",
        });
      }
      if (value.agreedAlimonyAmount <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["agreedAlimonyAmount"],
          message: "Enter the agreed payment amount",
        });
      }
      for (const [field, message] of [
        ["agreedAlimonyType", "Choose the agreed type of alimony"],
        ["agreedAlimonyFrequency", "Choose how often the agreed amount will be paid"],
        ["agreedAlimonyStartDate", "Enter when the agreed payments begin"],
        ["agreedAlimonyEndCondition", "Enter the agreed duration or ending condition"],
        ["agreedAlimonyModifiability", "Choose the agreed modification treatment"],
        ["agreedAlimonyPaymentMethod", "Choose the agreed payment method"],
        ["agreedAlimonySecurity", "Choose whether the obligation is secured"],
      ] as const) {
        if (!value[field] || (typeof value[field] === "string" && !value[field].trim())) {
          ctx.addIssue({ code: "custom", path: [field], message });
        }
      }
    }
  });

export type AlimonyFactors = z.infer<typeof alimonyFactorsSchema>;

// 11b. Marital settlement agreement terms -----------------------------------

export const settlementTermsSchema = z
  .object({
    fullDisclosureAcknowledged: z.boolean().refine(Boolean, {
      message: "Confirm that both parties made full and fair financial disclosure",
    }),
    contingentAssetsLiabilities: longTextSchema,
    beneficiaryDesignationMode: z.enum(["none", "maintain_for_spouse_or_children", "other"]),
    beneficiaryDesignationDetails: longTextSchema.optional(),
    parentingPlanExhibitLabel: shortTextSchema,
    childSupportObligor: z.enum(["you", "other_parent"]),
    agreedChildSupportMonthly: moneySchema,
    childSupportStartDate: isoDateSchema,
    childSupportEndDate: isoDateSchema,
    childSupportPaymentAmount: moneySchema,
    childSupportPaymentFrequency: z.enum(["weekly", "every_two_weeks", "twice_monthly", "monthly", "other"]),
    childSupportStepDownSchedule: longTextSchema,
    childSupportDeviationReason: longTextSchema,
    retroactiveChildSupport: moneySchema,
    childSupportArrearage: moneySchema,
    arrearsPaymentAmount: moneySchema,
    arrearsPaymentFrequency: z.enum(["weekly", "every_two_weeks", "monthly", "not_applicable"]),
    arrearsPaymentStartDate: optionalIsoDateSchema,
    healthInsuranceProvider: z.enum(["you", "other_parent", "not_available"]),
    uninsuredMedicalSplit: z.enum(["equal", "guideline_percentages", "other"]),
    uninsuredMedicalDetails: longTextSchema.optional(),
    dentalInsuranceProvider: z.enum(["you", "other_parent", "not_available"]),
    uninsuredDentalSplit: z.enum(["equal", "guideline_percentages", "other"]),
    uninsuredDentalDetails: longTextSchema.optional(),
    childSupportLifeInsuranceProvider: z.enum(["none", "you", "other_parent"]),
    childSupportLifeInsuranceAmount: moneySchema,
    taxExemptionTerms: longTextSchema,
    otherChildSupportTerms: longTextSchema,
    otherSettlementTerms: longTextSchema,
    unresolvedIssues: longTextSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.beneficiaryDesignationMode !== "none" &&
      !value.beneficiaryDesignationDetails?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["beneficiaryDesignationDetails"],
        message: "Describe the beneficiary designation that continues after the final judgment",
      });
    }
    if (value.uninsuredMedicalSplit === "other" && !value.uninsuredMedicalDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["uninsuredMedicalDetails"],
        message: "Describe the agreed medical-expense split",
      });
    }
    if (value.uninsuredDentalSplit === "other" && !value.uninsuredDentalDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["uninsuredDentalDetails"],
        message: "Describe the agreed dental-expense split",
      });
    }
    if (
      value.childSupportLifeInsuranceProvider !== "none" &&
      value.childSupportLifeInsuranceAmount <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["childSupportLifeInsuranceAmount"],
        message: "Enter the agreed life-insurance amount",
      });
    }
    if (
      value.retroactiveChildSupport + value.childSupportArrearage > 0 &&
      (value.arrearsPaymentAmount <= 0 ||
        value.arrearsPaymentFrequency === "not_applicable" ||
        !value.arrearsPaymentStartDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["arrearsPaymentAmount"],
        message: "Enter the payment amount, frequency, and start date for retroactive support or arrears",
      });
    }
  });

export type SettlementTerms = z.infer<typeof settlementTermsSchema>;

// 11c. Alimony advance and credit agreement ---------------------------------

export const advancePaymentItemSchema = z.object({
  id: z.string().min(1),
  dueDate: isoDateSchema,
  amount: moneySchema,
  note: shortTextSchema.optional(),
});

export type AdvancePaymentItem = z.infer<typeof advancePaymentItemSchema>;

export const alimonyAdvanceSchema = z
  .object({
    wantsAdvanceAgreement: yesNoSchema,
    payerFullLegalName: shortTextSchema.optional(),
    recipientFullLegalName: shortTextSchema.optional(),
    purpose: z.enum(["housing_transition", "other"]).optional(),
    intendedUseDetails: longTextSchema.optional(),
    targetMoveDate: optionalIsoDateSchema,
    advanceAmount: moneySchema,
    paymentScheduleType: z.enum(["single_payment", "installments"]).optional(),
    paymentDueDate: optionalIsoDateSchema,
    paymentSchedule: z
      .array(advancePaymentItemSchema)
      .max(24, "Add no more than 24 scheduled payments")
      .default([]),
    paymentMethod: z.enum(["cashiers_check", "wire_transfer", "attorney_trust", "other"]).optional(),
    paymentMethodDetails: shortTextSchema.optional(),
    finalSettlementAmount: moneySchema,
    creditMethod: z.enum(["dollar_for_dollar", "other"]).optional(),
    creditDetails: longTextSchema.optional(),
    ifFinalAgreementNotEntered: z
      .enum(["refund", "escrow_pending_agreement", "nonrefundable", "attorney_to_confirm"])
      .optional(),
    clearedFundsRequired: yesNoSchema.optional(),
    advanceNotes: longTextSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.wantsAdvanceAgreement !== "yes") return;
    if (!value.payerFullLegalName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["payerFullLegalName"],
        message: "Enter the paying spouse's full legal name",
      });
    }
    if (!value.recipientFullLegalName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["recipientFullLegalName"],
        message: "Enter the receiving spouse's full legal name",
      });
    }
    if (!value.purpose) {
      ctx.addIssue({
        code: "custom",
        path: ["purpose"],
        message: "Choose the purpose of the advance",
      });
    }
    if (!value.intendedUseDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["intendedUseDetails"],
        message: "Describe how the receiving spouse will use the advance",
      });
    }
    if (value.advanceAmount <= 0) {
      ctx.addIssue({ code: "custom", path: ["advanceAmount"], message: "Enter the advance payment amount" });
    }
    if (value.finalSettlementAmount <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["finalSettlementAmount"],
        message: "Enter the total agreed alimony settlement amount",
      });
    }
    if (value.advanceAmount > value.finalSettlementAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["advanceAmount"],
        message: "The advance cannot exceed the total agreed settlement amount",
      });
    }
    for (const [field, message] of [
      ["paymentScheduleType", "Choose a single payment or installment schedule"],
      ["paymentMethod", "Choose how the advance will be paid"],
      ["creditMethod", "Choose how the advance is credited"],
      ["ifFinalAgreementNotEntered", "Choose what happens if no final agreement or judgment is entered"],
      ["clearedFundsRequired", "Choose whether credit applies only after funds clear"],
    ] as const) {
      if (!value[field]) ctx.addIssue({ code: "custom", path: [field], message });
    }
    if (value.paymentScheduleType === "single_payment" && !value.paymentDueDate) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentDueDate"],
        message: "Enter when the advance payment is due",
      });
    }
    if (value.paymentScheduleType === "installments") {
      if (value.paymentSchedule.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["paymentSchedule"],
          message: "Add at least two installment payments",
        });
      }
      const scheduledTotal = value.paymentSchedule.reduce((total, payment) => total + payment.amount, 0);
      if (Math.abs(scheduledTotal - value.advanceAmount) >= 0.005) {
        ctx.addIssue({
          code: "custom",
          path: ["paymentSchedule"],
          message: "The scheduled payments must total the full advance amount",
        });
      }
    }
    if (value.paymentMethod === "other" && !value.paymentMethodDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethodDetails"],
        message: "Describe the payment method",
      });
    }
    if (value.creditMethod === "other" && !value.creditDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["creditDetails"],
        message: "Describe how the advance is credited",
      });
    }
  });

export type AlimonyAdvance = z.infer<typeof alimonyAdvanceSchema>;

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

// 14. Filing details -----------------------------------------------------------

/**
 * The identifying details a court filing needs but a support calculation does
 * not.
 *
 * Everything else in this intake deliberately accepts initials — the estimate
 * does not care who you are, and collecting less is the safer default for an
 * app holding somebody's divorce finances. A filing is the opposite: the clerk
 * needs full legal names, addresses, and dates.
 *
 * So this step is **opt-in**. `wantsFilingPacket` gates the rest, and when it
 * is "no" nothing here is required and nothing is collected. Data
 * minimisation only means something if the minimal path is genuinely
 * available.
 *
 * Social Security numbers are deliberately **not** collected, even though
 * Florida requires form 12.902(j) to carry them. They contribute nothing to
 * any calculation, and holding them would raise the consequences of a breach
 * far more than it raises the usefulness of the packet. The generated packet
 * lists that form and tells the person to complete it by hand.
 */
const addressSchema = z.object({
  street: shortTextSchema.optional(),
  city: shortTextSchema.optional(),
  state: shortTextSchema.optional(),
  postalCode: shortTextSchema.optional(),
});

export type FilingAddress = z.infer<typeof addressSchema>;

const partyFilingDetailsSchema = z.object({
  fullLegalName: shortTextSchema.optional(),
  dateOfBirth: optionalIsoDateSchema,
  address: addressSchema.default({}),
  phoneNumber: shortTextSchema.optional(),
  emailAddress: shortTextSchema.optional(),
  employerName: shortTextSchema.optional(),
  employerAddress: shortTextSchema.optional(),
  /**
   * Servicemembers Civil Relief Act protections change how a default may be
   * entered, so an uncontested filing has to state this either way.
   */
  militaryService: z.enum(["none", "active_duty", "reserve_or_guard", "not_sure"]).optional(),
});

export type PartyFilingDetails = z.infer<typeof partyFilingDetailsSchema>;

const childResidenceSchema = z
  .object({
    address: requiredShortTextSchema,
    fromDate: isoDateSchema,
    untilDate: optionalIsoDateSchema,
    livedWithNameAndAddress: requiredShortTextSchema,
    relationship: requiredShortTextSchema,
  })
  .superRefine((value, ctx) => {
    if (value.untilDate && Date.parse(value.untilDate) < Date.parse(value.fromDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["untilDate"],
        message: "The end date cannot be before the start date",
      });
    }
  });

export type ChildResidence = z.infer<typeof childResidenceSchema>;

/** Per-child details a filing needs that the support calculation does not. */
const childFilingDetailsSchema = z
  .object({
    /** Matches `childSchema.id` so this never has to guess which child it means. */
    childId: z.string().min(1),
    fullLegalName: shortTextSchema.optional(),
    placeOfBirth: shortTextSchema.optional(),
    sex: z.enum(["female", "male", "another_or_not_listed"]).optional(),
    residences: z.array(childResidenceSchema).max(6, "The official form has room for six residences per child").default([]),
    /** Retained only so drafts saved before structured residence rows still load. */
    addressHistory: longTextSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.residences.length === 0) return;
    if (value.residences[0]?.untilDate) {
      ctx.addIssue({
        code: "custom",
        path: ["residences", 0, "untilDate"],
        message: "The first row is the current residence, so its end date must be blank",
      });
    }
    for (let index = 1; index < value.residences.length; index += 1) {
      const newer = value.residences[index - 1];
      const older = value.residences[index];
      if (!older?.untilDate) {
        ctx.addIssue({
          code: "custom",
          path: ["residences", index, "untilDate"],
          message: "Enter when this previous residence ended",
        });
      } else if (newer && older.untilDate !== newer.fromDate) {
        ctx.addIssue({
          code: "custom",
          path: ["residences", index, "untilDate"],
          message: "Residence dates must connect without an unexplained gap",
        });
      }
    }
    const oldest = value.residences.at(-1);
    if (oldest) {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
      if (Date.parse(oldest.fromDate) > fiveYearsAgo.getTime()) {
        ctx.addIssue({
          code: "custom",
          path: ["residences", value.residences.length - 1, "fromDate"],
          message: "Add earlier residences until the history covers at least five years",
        });
      }
    }
  });

export type ChildFilingDetails = z.infer<typeof childFilingDetailsSchema>;

const priorCustodyProceedingDetailsSchema = z.object({
  childNames: shortTextSchema.optional(),
  proceedingType: shortTextSchema.optional(),
  courtAndState: shortTextSchema.optional(),
  orderDate: optionalIsoDateSchema.optional(),
});

const pendingCustodyProceedingDetailsSchema = priorCustodyProceedingDetailsSchema.extend({
  caseNumber: shortTextSchema.optional(),
});

const thirdPartyCustodyClaimDetailsSchema = z.object({
  nameAndAddress: shortTextSchema.optional(),
  childNames: shortTextSchema.optional(),
  relationshipToChildren: shortTextSchema.optional(),
  claimType: z.enum(["physical_custody", "custody_rights", "visitation_or_time_sharing"]).optional(),
});

const existingChildSupportOrderDetailsSchema = z.object({
  childNames: shortTextSchema.optional(),
  proceedingType: shortTextSchema.optional(),
  courtAndAddress: shortTextSchema.optional(),
  orderDate: optionalIsoDateSchema.optional(),
  amountAndPayer: shortTextSchema.optional(),
});

export const filingDetailsSchema = z
  .object({
    wantsFilingPacket: yesNoSchema,
    you: partyFilingDetailsSchema.default(() => ({ address: {}, dateOfBirth: undefined })),
    spouse: partyFilingDetailsSchema.default(() => ({ address: {}, dateOfBirth: undefined })),
    children: z.array(childFilingDetailsSchema).default([]),
    judicialCircuit: shortTextSchema.optional(),
    caseNumber: shortTextSchema.optional(),
    division: shortTextSchema.optional(),
    relatedCasesStatus: z.enum(["none", "listed_separately", "not_sure"]).optional(),
    marriagePlaceCity: shortTextSchema.optional(),
    marriagePlaceStateOrCountry: shortTextSchema.optional(),
    /**
     * §61.021 requires one party to have resided in Florida for six months
     * before filing. The date is collected rather than a yes/no so the
     * readiness check is arithmetic instead of self-assessment.
     */
    floridaResidentSince: optionalIsoDateSchema,
    whichPartyIsFloridaResident: z.enum(["you", "spouse", "both", "neither"]).optional(),
    marriageGround: z.enum(["irretrievably_broken", "mental_incapacity"]).optional(),
    financialAffidavitStatus: z.enum(["filed_with_petition", "will_be_timely_filed"]).optional(),
    pregnancyStatus: z.enum(["none", "petitioner", "respondent"]).optional(),
    pregnancyDueDate: optionalIsoDateSchema,
    nonCommonMinorChildrenStatus: yesNoSchema.optional(),
    nonCommonMinorChildrenDetails: longTextSchema.optional(),
    adultDependentChildrenStatus: yesNoSchema.optional(),
    adultDependentChildrenDetails: longTextSchema.optional(),
    propertyDistributionRequest: z.enum(["written_agreement", "court_determination", "other_property_interest"]).optional(),
    propertyInterestRecipient: z.enum(["petitioner", "respondent"]).optional(),
    propertyInterestExplanation: longTextSchema.optional(),
    childrenCurrentResidence: z.enum(["petitioner", "respondent", "other"]).optional(),
    childrenCurrentResidenceExplanation: longTextSchema.optional(),
    parentalResponsibilityRequest: z.enum(["shared", "sole_petitioner", "sole_respondent"]).optional(),
    soleResponsibilityDetrimentExplanation: longTextSchema.optional(),
    parentingPlanIncludesTimeSharing: yesNoSchema.optional(),
    parentingBestInterestsExplanation: longTextSchema.optional(),
    childSupportWorksheetStatus: z.enum(["filed_with_petition", "will_be_timely_filed"]).optional(),
    retroactiveChildSupportStart: z.enum(["none", "separation", "filing", "other"]).optional(),
    retroactiveChildSupportOtherDate: optionalIsoDateSchema,
    retroactiveChildSupportOtherExplanation: longTextSchema.optional(),
    supportBeyondEighteen: z.enum(["none", "incapacity", "high_school"]).optional(),
    supportBeyondEighteenDetails: longTextSchema.optional(),
    childSupportDeviationRequested: yesNoSchema.optional(),
    otherReliefRequested: longTextSchema.optional(),
    /** Whether a spouse asks the court to restore a former name. */
    formerNameRestorationRequested: yesNoSchema.optional(),
    formerNameToRestore: shortTextSchema.optional(),
    priorCustodyProceedingStatus: z.enum(["none", "exists", "not_sure"]).optional(),
    priorCustodyProceedingDetails: priorCustodyProceedingDetailsSchema.default({}),
    pendingCustodyProceedingStatus: z.enum(["none", "exists", "not_sure"]).optional(),
    pendingCustodyProceedingDetails: pendingCustodyProceedingDetailsSchema.default({}),
    thirdPartyCustodyClaimStatus: z.enum(["none", "exists", "not_sure"]).optional(),
    thirdPartyCustodyClaimDetails: thirdPartyCustodyClaimDetailsSchema.default({}),
    existingChildSupportOrderStatus: z.enum(["none", "exists", "not_sure"]).optional(),
    existingChildSupportOrderDetails: existingChildSupportOrderDetailsSchema.default({}),
  })
  .superRefine((value, ctx) => {
    // Nothing below is required unless the person actually wants the packet.
    if (value.wantsFilingPacket !== "yes") return;

    if (!value.you.fullLegalName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["you", "fullLegalName"],
        message: "Enter your full legal name as it appears on your ID",
      });
    }
    if (!value.spouse.fullLegalName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["spouse", "fullLegalName"],
        message: "Enter your spouse's full legal name",
      });
    }
    for (const [party, path, label] of [
      [value.you, "you", "your"],
      [value.spouse, "spouse", "your spouse's"],
    ] as const) {
      if (!party.militaryService) {
        ctx.addIssue({
          code: "custom",
          path: [path, "militaryService"],
          message: `Choose ${label} military-service status`,
        });
      }
    }
    if (!value.you.address.street?.trim() || !value.you.address.city?.trim() || !value.you.address.state?.trim() || !value.you.address.postalCode?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["you", "address", "street"],
        message: "Enter your complete mailing address",
      });
    }
    if (!value.you.phoneNumber?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["you", "phoneNumber"],
        message: "Enter the telephone number used on court forms",
      });
    }
    if (!value.you.emailAddress?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["you", "emailAddress"],
        message: "Enter the designated email address used on court forms",
      });
    }
    if (!value.marriagePlaceCity?.trim() || !value.marriagePlaceStateOrCountry?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["marriagePlaceCity"],
        message: "Enter where the marriage took place",
      });
    }
    if (!value.relatedCasesStatus) {
      ctx.addIssue({
        code: "custom",
        path: ["relatedCasesStatus"],
        message: "Choose whether related family cases exist",
      });
    }
    if (!value.whichPartyIsFloridaResident) {
      ctx.addIssue({
        code: "custom",
        path: ["whichPartyIsFloridaResident"],
        message: "Choose who has lived in Florida",
      });
    }
    for (const [field, label] of [
      ["marriageGround", "the legal ground for dissolution"],
      ["financialAffidavitStatus", "when the financial affidavit will be filed"],
      ["pregnancyStatus", "whether either party is pregnant"],
      ["nonCommonMinorChildrenStatus", "whether there are children not common to both parties"],
      ["adultDependentChildrenStatus", "whether there are adult dependent children"],
      ["propertyDistributionRequest", "how property division should be handled"],
      ["childrenCurrentResidence", "where the children currently reside"],
      ["parentalResponsibilityRequest", "the requested parental-responsibility arrangement"],
      ["parentingPlanIncludesTimeSharing", "whether the proposed plan includes time-sharing"],
      ["childSupportWorksheetStatus", "when the child-support worksheet will be filed"],
      ["retroactiveChildSupportStart", "whether retroactive child support is requested"],
      ["supportBeyondEighteen", "whether support beyond age 18 is requested"],
      ["childSupportDeviationRequested", "whether a child-support deviation is requested"],
    ] as const) {
      if (!value[field]) {
        ctx.addIssue({ code: "custom", path: [field], message: `Choose ${label}` });
      }
    }
    if (value.pregnancyStatus && value.pregnancyStatus !== "none" && !value.pregnancyDueDate) {
      ctx.addIssue({ code: "custom", path: ["pregnancyDueDate"], message: "Enter the expected due date" });
    }
    if (value.nonCommonMinorChildrenStatus === "yes" && !value.nonCommonMinorChildrenDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["nonCommonMinorChildrenDetails"],
        message: "List each child, birth date, and birth parent's name and address",
      });
    }
    if (value.adultDependentChildrenStatus === "yes" && !value.adultDependentChildrenDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["adultDependentChildrenDetails"],
        message: "List each adult dependent child, birth date, and disability details",
      });
    }
    if (value.propertyDistributionRequest === "other_property_interest") {
      if (!value.propertyInterestRecipient) {
        ctx.addIssue({
          code: "custom",
          path: ["propertyInterestRecipient"],
          message: "Choose who is requesting an interest in the other spouse's property",
        });
      }
      if (!value.propertyInterestExplanation?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["propertyInterestExplanation"],
          message: "Explain the requested interest in the other spouse's property",
        });
      }
    }
    if (value.childrenCurrentResidence === "other" && !value.childrenCurrentResidenceExplanation?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["childrenCurrentResidenceExplanation"],
        message: "Explain where and with whom the children currently reside",
      });
    }
    if (
      (value.parentalResponsibilityRequest === "sole_petitioner" ||
        value.parentalResponsibilityRequest === "sole_respondent") &&
      !value.soleResponsibilityDetrimentExplanation?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["soleResponsibilityDetrimentExplanation"],
        message: "Explain why shared parental responsibility would be detrimental to the children",
      });
    }
    if (!value.parentingBestInterestsExplanation?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["parentingBestInterestsExplanation"],
        message: "Explain why the requested parenting plan is in the children's best interests",
      });
    }
    if (value.retroactiveChildSupportStart === "other") {
      if (!value.retroactiveChildSupportOtherDate) {
        ctx.addIssue({
          code: "custom",
          path: ["retroactiveChildSupportOtherDate"],
          message: "Enter the requested retroactive-support start date",
        });
      }
      if (!value.retroactiveChildSupportOtherExplanation?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["retroactiveChildSupportOtherExplanation"],
          message: "Explain the other requested retroactive-support date",
        });
      }
    }
    if (value.supportBeyondEighteen !== "none" && !value.supportBeyondEighteenDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["supportBeyondEighteenDetails"],
        message: "Identify the child and explain the requested support beyond age 18",
      });
    }
    if (value.whichPartyIsFloridaResident && value.whichPartyIsFloridaResident !== "neither" && !value.floridaResidentSince) {
      ctx.addIssue({
        code: "custom",
        path: ["floridaResidentSince"],
        message: "Enter the date Florida residence began",
      });
    }
    if (value.formerNameRestorationRequested === "yes" && !value.formerNameToRestore?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["formerNameToRestore"],
        message: "Enter the former name to restore",
      });
    }
    for (const [index, child] of value.children.entries()) {
      if (!child.fullLegalName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["children", index, "fullLegalName"],
          message: "Enter this child's full legal name",
        });
      }
      if (!child.placeOfBirth?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["children", index, "placeOfBirth"],
          message: "Enter this child's place of birth",
        });
      }
      if (!child.sex) {
        ctx.addIssue({
          code: "custom",
          path: ["children", index, "sex"],
          message: "Choose the entry to place in the form's sex field",
        });
      }
      if (child.residences.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["children", index, "residences"],
          message: "Add this child's residences covering the last five years",
        });
      }
    }
    if (value.children.length > 0) {
      for (const [field, label] of [
        ["priorCustodyProceedingStatus", "prior custody or time-sharing proceedings"],
        ["pendingCustodyProceedingStatus", "pending custody or time-sharing proceedings"],
        ["thirdPartyCustodyClaimStatus", "non-party custody or time-sharing claims"],
        ["existingChildSupportOrderStatus", "existing child-support orders"],
      ] as const) {
        const status = value[field];
        if (!status) {
          ctx.addIssue({ code: "custom", path: [field], message: `Answer the question about ${label}` });
        }
      }
      if (value.priorCustodyProceedingStatus === "exists") {
        for (const [field, label] of [
          ["childNames", "child name(s)"],
          ["proceedingType", "type of proceeding"],
          ["courtAndState", "court and state"],
        ] as const) {
          if (!value.priorCustodyProceedingDetails[field]?.trim()) {
            ctx.addIssue({
              code: "custom",
              path: ["priorCustodyProceedingDetails", field],
              message: `Enter the ${label}`,
            });
          }
        }
      }
      if (value.pendingCustodyProceedingStatus === "exists") {
        for (const [field, label] of [
          ["childNames", "child name(s)"],
          ["proceedingType", "type of proceeding"],
          ["courtAndState", "court and state"],
          ["caseNumber", "case number"],
        ] as const) {
          if (!value.pendingCustodyProceedingDetails[field]?.trim()) {
            ctx.addIssue({
              code: "custom",
              path: ["pendingCustodyProceedingDetails", field],
              message: `Enter the ${label}`,
            });
          }
        }
      }
      if (value.thirdPartyCustodyClaimStatus === "exists") {
        for (const [field, label] of [
          ["nameAndAddress", "person's name and address"],
          ["childNames", "affected child name(s)"],
          ["relationshipToChildren", "relationship to the child or children"],
        ] as const) {
          if (!value.thirdPartyCustodyClaimDetails[field]?.trim()) {
            ctx.addIssue({
              code: "custom",
              path: ["thirdPartyCustodyClaimDetails", field],
              message: `Enter the ${label}`,
            });
          }
        }
        if (!value.thirdPartyCustodyClaimDetails.claimType) {
          ctx.addIssue({
            code: "custom",
            path: ["thirdPartyCustodyClaimDetails", "claimType"],
            message: "Choose the type of custody or time-sharing claim",
          });
        }
      }
      if (value.existingChildSupportOrderStatus === "exists") {
        for (const [field, label] of [
          ["childNames", "child name(s)"],
          ["proceedingType", "type of proceeding"],
          ["courtAndAddress", "court and address"],
          ["amountAndPayer", "support amount and who pays"],
        ] as const) {
          if (!value.existingChildSupportOrderDetails[field]?.trim()) {
            ctx.addIssue({
              code: "custom",
              path: ["existingChildSupportOrderDetails", field],
              message: `Enter the ${label}`,
            });
          }
        }
      }
    }
  });

export type FilingDetails = z.infer<typeof filingDetailsSchema>;
