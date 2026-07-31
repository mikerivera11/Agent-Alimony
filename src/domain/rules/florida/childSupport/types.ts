/**
 * Input/result types for the Fla. Stat. §61.30 child support ruleset.
 * Raw input is validated with Zod; the validated shape is what callers must
 * wrap in a `ConfirmedFact` before calling `calculateFloridaChildSupport`.
 */
import { z } from "zod";

export const CHILD_SUPPORT_PARENT_IDS = ["parent1", "parent2"] as const;
export type ChildSupportParentId = (typeof CHILD_SUPPORT_PARENT_IDS)[number];

export const childSupportDeductionsSchema = z.object({
  /** Fla. Stat. §61.30(3)(a). */
  federalStateLocalIncomeTaxCents: z.number().int().nonnegative().default(0),
  /** Fla. Stat. §61.30(3)(b) — FICA or self-employment tax. */
  ficaOrSelfEmploymentTaxCents: z.number().int().nonnegative().default(0),
  /** Fla. Stat. §61.30(3)(d). */
  mandatoryRetirementCents: z.number().int().nonnegative().default(0),
  /** Fla. Stat. §61.30(3)(e) — excludes coverage for the minor child(ren). */
  healthInsurancePremiumSelfOnlyCents: z.number().int().nonnegative().default(0),
  /** Fla. Stat. §61.30(3)(f) — actually paid. */
  courtOrderedSupportForOtherChildrenPaidCents: z.number().int().nonnegative().default(0),
  /** Fla. Stat. §61.30(3)(g) — from a prior marriage or order. */
  spousalSupportPaidUnderPriorOrderCents: z.number().int().nonnegative().default(0),
});
export type ChildSupportDeductions = z.infer<typeof childSupportDeductionsSchema>;

export const childSupportPartyInputSchema = z.object({
  parentId: z.enum(CHILD_SUPPORT_PARENT_IDS),
  monthlyGrossIncomeCents: z.number().int().nonnegative(),
  deductions: childSupportDeductionsSchema,
  /** Overnights this parent has with the child(ren) in the period covered by `totalNightsInPeriod`. */
  overnightsWithChild: z.number().int().nonnegative(),
  /** Prepaid child-care costs this parent already paid directly to a provider. */
  childCarePrepaidCents: z.number().int().nonnegative().default(0),
  /** Prepaid health/dental/prescription costs this parent already paid directly. */
  childHealthCostsPrepaidCents: z.number().int().nonnegative().default(0),
});
export type ChildSupportPartyInput = z.infer<typeof childSupportPartyInputSchema>;

export const socialSecurityChildBenefitCreditSchema = z.object({
  /** The parent whose retirement/disability generated the benefit. Fla. Stat. §61.30(10)(b). */
  attributableToParentId: z.enum(CHILD_SUPPORT_PARENT_IDS),
  monthlyBenefitPaidToChildOrCaregiverCents: z.number().int().nonnegative(),
});
export type SocialSecurityChildBenefitCredit = z.infer<
  typeof socialSecurityChildBenefitCreditSchema
>;

export const childSupportInputSchema = z
  .object({
    numberOfChildren: z.number().int().min(1),
    parents: z.tuple([childSupportPartyInputSchema, childSupportPartyInputSchema]),
    /** Days in the period overnights are measured over; default is a standard (non-leap) year. */
    totalNightsInPeriod: z.number().int().positive().default(365),
    monthlyChildCareCostsCents: z.number().int().nonnegative().default(0),
    monthlyChildHealthInsuranceCents: z.number().int().nonnegative().default(0),
    socialSecurityChildBenefitCredit: socialSecurityChildBenefitCreditSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.parents[0].parentId === value.parents[1].parentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parents"],
        message: "The two parents must have distinct parentId values (parent1 and parent2).",
      });
    }
    const totalOvernights = value.parents[0].overnightsWithChild + value.parents[1].overnightsWithChild;
    if (totalOvernights > value.totalNightsInPeriod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parents"],
        message: `Combined overnights (${totalOvernights}) cannot exceed totalNightsInPeriod (${value.totalNightsInPeriod}).`,
      });
    }
  });
export type ChildSupportInput = z.infer<typeof childSupportInputSchema>;

export interface ChildSupportParentResult {
  readonly parentId: ChildSupportParentId;
  readonly monthlyGrossIncomeCents: number;
  readonly monthlyNetIncomeCents: number;
  readonly incomeSharePercentBasisPoints: number;
  readonly overnightsWithChild: number;
  readonly overnightSharePercentBasisPoints: number;
  readonly dollarShareOfTotalNeedCents: number;
  /** What this parent must pay the other parent per month; 0 if this parent is the payee. */
  readonly monthlyPaymentOwedCents: number;
}

export interface ChildSupportResult {
  readonly numberOfChildren: number;
  readonly combinedNetMonthlyIncomeCents: number;
  readonly scheduleRowCombinedNetIncomeCents: number;
  readonly scheduleRowNormalizedFromRequestedIncome: boolean;
  readonly wasAboveSchedule: boolean;
  readonly basicMonthlyNeedCents: number;
  readonly childCareAddOnCents: number;
  readonly childHealthInsuranceAddOnCents: number;
  readonly totalMinimumChildSupportNeedCents: number;
  readonly substantialTimeSharingApplied: boolean;
  readonly obligorParentId: ChildSupportParentId | null;
  /** Net monthly amount the obligor pays the obligee, after all credits. */
  readonly monthlyTransferAmountCents: number;
  readonly socialSecurityCreditAppliedCents: number;
  readonly parents: readonly [ChildSupportParentResult, ChildSupportParentResult];
}
