/**
 * Input/result types for the Fla. Stat. §61.08 alimony ruleset.
 */
import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be ISO 8601 (YYYY-MM-DD).");

export const alimonyDeductionsSchema = z.object({
  /** Fla. Stat. §61.30(3)(a), incorporated by reference via §61.08(8)(c). */
  federalStateLocalIncomeTaxCents: z.number().int().nonnegative().default(0),
  ficaOrSelfEmploymentTaxCents: z.number().int().nonnegative().default(0),
  mandatoryRetirementCents: z.number().int().nonnegative().default(0),
  healthInsurancePremiumSelfOnlyCents: z.number().int().nonnegative().default(0),
  courtOrderedSupportForOtherChildrenPaidCents: z.number().int().nonnegative().default(0),
  /**
   * Spousal support paid under a PRIOR order (a different marriage, or an
   * order that predates this action). Support from the pending action
   * between these two parties is excluded from net income by definition —
   * Fla. Stat. §61.08(8)(c) — and is therefore not a field on this schema.
   */
  spousalSupportPaidUnderPriorOrderCents: z.number().int().nonnegative().default(0),
});
export type AlimonyDeductions = z.infer<typeof alimonyDeductionsSchema>;

export const alimonyPartyInputSchema = z.object({
  monthlyGrossIncomeCents: z.number().int().nonnegative(),
  deductions: alimonyDeductionsSchema,
});
export type AlimonyPartyInput = z.infer<typeof alimonyPartyInputSchema>;

export const ALIMONY_FORMS = ["bridgeTheGap", "rehabilitative", "durational"] as const;
export type AlimonyForm = (typeof ALIMONY_FORMS)[number];

/**
 * How each form of alimony is named in §61.08, for display.
 *
 * The identifiers above are camelCase because they are code. Rendering them
 * raw put "bridgeTheGap" in front of users, which is both unreadable and not
 * what the statute calls it.
 */
export const ALIMONY_FORM_LABELS: Record<AlimonyForm, string> = {
  bridgeTheGap: "Bridge-the-gap alimony",
  rehabilitative: "Rehabilitative alimony",
  durational: "Durational alimony",
};

export const alimonyInputSchema = z
  .object({
    marriageDateIso: isoDateSchema,
    petitionFilingDateIso: isoDateSchema,
    payor: alimonyPartyInputSchema,
    obligee: alimonyPartyInputSchema,
    /** The obligee's documented monthly reasonable need, established by evidence. §61.08(8)(c). */
    confirmedReasonableMonthlyNeedCents: z.number().int().nonnegative(),
    /** Whether a specific, defined rehabilitative plan is on record. §61.08(7)(b). */
    rehabilitativePlanConfirmed: z.boolean().default(false),
    /** Whether the obligee is requesting a durational extension beyond the statutory ceiling. §61.08(8)(a)-(b). */
    exceptionalCircumstancesExtensionRequested: z.boolean().default(false),
    /** Whether the threshold "actual need" determination is actively disputed. §61.08(2)(a). */
    needDisputed: z.boolean().default(false),
    /** Whether the threshold "ability to pay" determination is actively disputed. §61.08(2)(a). */
    abilityToPayDisputed: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.petitionFilingDateIso < value.marriageDateIso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["petitionFilingDateIso"],
        message: "Petition filing date cannot precede the marriage date.",
      });
    }
  });
export type AlimonyInput = z.infer<typeof alimonyInputSchema>;

export type MarriageDurationCategory = "short" | "moderate" | "long";

export interface AlimonyFormAvailability {
  readonly form: AlimonyForm;
  readonly available: boolean;
  readonly reason: string;
  readonly maxDurationMonths: number | null;
}

export interface AlimonySubsectionThreeFactor {
  readonly factorId: string;
  readonly citation: string;
  readonly description: string;
}

export interface AlimonyAmountCeiling {
  readonly rangeFloorCents: 0;
  readonly rangeCeilingCents: number;
  readonly limitingFactor: "reasonableNeed" | "thirtyFivePercentIncomeDifference";
  readonly confirmedReasonableMonthlyNeedCents: number;
  readonly thirtyFivePercentOfIncomeDifferenceCents: number;
}

export interface AlimonyPostScenarioCashFlow {
  readonly payorNetMonthlyIncomeBeforeCents: number;
  readonly obligeeNetMonthlyIncomeBeforeCents: number;
  readonly payorNetMonthlyIncomeAfterCents: number;
  readonly obligeeNetMonthlyIncomeAfterCents: number;
}

export interface AlimonyResult {
  readonly marriageDurationCategory: MarriageDurationCategory;
  readonly marriageDurationMonths: number;
  readonly marriageDurationDays: number;
  readonly formAvailability: readonly AlimonyFormAvailability[];
  readonly payorNetMonthlyIncomeCents: number;
  readonly obligeeNetMonthlyIncomeCents: number;
  readonly netIncomeDifferenceCents: number;
  readonly amountCeiling: AlimonyAmountCeiling;
  readonly postScenarioCashFlowAtCeiling: AlimonyPostScenarioCashFlow;
  readonly subsectionThreeFactors: readonly AlimonySubsectionThreeFactor[];
}
