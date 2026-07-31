/**
 * Input/result types for the Fla. Stat. §61.075 equitable-distribution
 * ruleset.
 *
 * The engine takes an itemized list of the parties' assets and liabilities,
 * sets apart each spouse's nonmarital property, totals the marital estate,
 * and — starting from the statutory premise that distribution is EQUAL
 * (§61.075(1)) — computes the equalizing payment needed to reach a 50/50
 * split of the net marital estate. It never predicts an unequal distribution
 * (there is no statutory formula for one) and never scores the §61.075(1)
 * factors.
 */
import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be ISO 8601 (YYYY-MM-DD).");

/** Which spouse holds, is assigned, or owns an item. */
export const ED_SPOUSES = ["a", "b"] as const;
export type EdSpouse = (typeof ED_SPOUSES)[number];

/** Which spouse (or jointly) currently holds / is assigned an item. */
export const ED_OWNERS = ["a", "b", "joint"] as const;
export type EdOwner = (typeof ED_OWNERS)[number];

export const ED_ITEM_TYPES = ["asset", "liability"] as const;
export type EdItemType = (typeof ED_ITEM_TYPES)[number];

export const ED_CATEGORIES = [
  "realProperty",
  "retirementAccount",
  "bankAccount",
  "investment",
  "vehicle",
  "business",
  "personalProperty",
  "creditCardDebt",
  "loan",
  "mortgage",
  "other",
] as const;
export type EdCategory = (typeof ED_CATEGORIES)[number];

/**
 * How the item is classified for distribution.
 * - `marital`: established marital (§61.075(6)(a)).
 * - `presumedMarital`: acquired after the marriage date and not established as
 *   nonmarital, so presumed marital under §61.075(8) (rebuttable). Treated
 *   identically to `marital` for the estate math.
 * - `nonmarital`: set apart to its owner under §61.075(6)(b); never part of
 *   the marital estate.
 * - `disputed`: classification is actively contested. This ruleset does not
 *   resolve classification disputes and returns requiresProfessionalReview.
 */
export const ED_CLASSIFICATIONS = ["marital", "presumedMarital", "nonmarital", "disputed"] as const;
export type EdClassification = (typeof ED_CLASSIFICATIONS)[number];

/**
 * The statutory basis for a NONMARITAL classification, mapped to the
 * §61.075(6)(b) subparagraph. Subparagraph 4 (property excluded by a valid
 * written agreement) is intentionally NOT in this enum — that basis is
 * expressed through the `excludedByWrittenAgreement` flag on a marital/
 * presumed-marital item instead, because "excluding from the marital estate"
 * only makes sense for something that would otherwise be in it.
 */
export const ED_NONMARITAL_BASES = [
  "acquiredBeforeMarriage", // §61.075(6)(b)1
  "separateGiftOrInheritance", // §61.075(6)(b)2 (noninterspousal gift, bequest, devise, descent)
  "incomeFromNonmaritalAsset", // §61.075(6)(b)3
  "forgeryLiability", // §61.075(6)(b)5
  "separatelyAcquiredRealProperty", // §61.075(6)(b)6
] as const;
export type EdNonmaritalBasis = (typeof ED_NONMARITAL_BASES)[number];

export const ED_NONMARITAL_BASIS_CITATIONS: Record<EdNonmaritalBasis, string> = {
  acquiredBeforeMarriage: "Fla. Stat. §61.075(6)(b)1",
  separateGiftOrInheritance: "Fla. Stat. §61.075(6)(b)2",
  incomeFromNonmaritalAsset: "Fla. Stat. §61.075(6)(b)3",
  forgeryLiability: "Fla. Stat. §61.075(6)(b)5",
  separatelyAcquiredRealProperty: "Fla. Stat. §61.075(6)(b)6",
};

export const equitableDistributionItemSchema = z
  .object({
    /** Stable identifier for this item (used to reference it in the trace). */
    id: z.string().min(1),
    /** Plain-language label the user recognizes. */
    label: z.string().min(1),
    category: z.enum(ED_CATEGORIES),
    type: z.enum(ED_ITEM_TYPES),
    /**
     * Value in integer cents. Always non-negative: a liability is entered as
     * its own `type: "liability"` with a positive magnitude, never as a
     * negative asset.
     */
    valueCents: z.number().int().nonnegative(),
    classification: z.enum(ED_CLASSIFICATIONS),
    /** Required when (and only when) `classification === "nonmarital"`. */
    nonmaritalBasis: z.enum(ED_NONMARITAL_BASES).optional(),
    /** Which spouse holds / is assigned / owns the item. */
    owner: z.enum(ED_OWNERS),
    /**
     * The parties agree, by a written agreement, that this item is excluded
     * from the marital estate under §61.075(6)(b)4. Only honored when the
     * input's `writtenAgreementConfirmed` flag is also true.
     */
    excludedByWrittenAgreement: z.boolean().default(false),
  })
  .superRefine((item, ctx) => {
    if (item.classification === "nonmarital" && item.nonmaritalBasis === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nonmaritalBasis"],
        message: "A nonmarital item must state its §61.075(6)(b) basis.",
      });
    }
    if (item.classification !== "nonmarital" && item.nonmaritalBasis !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nonmaritalBasis"],
        message: "Only a nonmarital item may carry a §61.075(6)(b) basis.",
      });
    }
    if (item.excludedByWrittenAgreement && item.classification === "nonmarital") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["excludedByWrittenAgreement"],
        message:
          "An item excluded by written agreement must be classified marital or presumedMarital; a nonmarital item is already set apart and has nothing to exclude.",
      });
    }
  });
export type EquitableDistributionItem = z.infer<typeof equitableDistributionItemSchema>;

export const equitableDistributionInputSchema = z
  .object({
    items: z.array(equitableDistributionItemSchema),
    /**
     * Whether a valid written agreement of the parties actually exists to
     * support any `excludedByWrittenAgreement` items. Without it, exclusions
     * are not honored and a blocking flag is raised. §61.075(6)(b)4.
     */
    writtenAgreementConfirmed: z.boolean().default(false),
    /**
     * The §61.075(7) classification cut-off date (earliest of the date of a
     * valid separation agreement, a date established by that agreement, or the
     * date the petition was filed). Recorded for the trace only; this ruleset
     * does not itself re-classify items by acquisition date.
     */
    classificationCutoffDateIso: isoDateSchema.optional(),
    partyALabel: z.string().min(1).default("Spouse A"),
    partyBLabel: z.string().min(1).default("Spouse B"),
    /**
     * A party requests an UNEQUAL distribution based on the §61.075(1)
     * factors. There is no statutory formula for the deviation, so this
     * ruleset returns requiresProfessionalReview rather than guessing.
     */
    unequalDistributionRequested: z.boolean().default(false),
    /**
     * A claim of intentional dissipation, waste, depletion, or destruction of
     * marital assets under §61.075(1)(i) is present. Not implemented; returns
     * requiresProfessionalReview.
     */
    dissipationClaimPresent: z.boolean().default(false),
    /**
     * A claim that marital funds/effort paid down principal on a note/mortgage
     * secured by NONMARITAL real property under §61.075(6)(a)1.c is present.
     * The coverture-fraction passive-appreciation formula is not implemented;
     * returns requiresProfessionalReview.
     */
    nonmaritalMortgagePaydownClaimPresent: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "id"],
          message: `Duplicate item id: ${item.id}`,
        });
      }
      seen.add(item.id);
    });
  });
export type EquitableDistributionInput = z.infer<typeof equitableDistributionInputSchema>;

/** A §61.075(1)(a)-(j) factor that may justify an unequal distribution. */
export interface UnequalDistributionFactor {
  readonly factorId: string;
  readonly citation: string;
  readonly description: string;
}

export interface EqualizingPayment {
  /** Spouse who owes the payment, or null when no payment is needed. */
  readonly fromSpouse: EdSpouse | null;
  /** Spouse who receives the payment, or null when no payment is needed. */
  readonly toSpouse: EdSpouse | null;
  readonly amountCents: number;
}

/** A single computed 50/50 distribution over some marital estate. */
export interface DistributionScenario {
  readonly maritalAssetsCents: number;
  readonly maritalLiabilitiesCents: number;
  readonly netMaritalEstateCents: number;
  /** Equal-premise target for each spouse (§61.075(1)); the two sum to net. */
  readonly targetShareACents: number;
  readonly targetShareBCents: number;
  /** What each spouse currently holds/is assigned within this estate. */
  readonly holdingACents: number;
  readonly holdingBCents: number;
  readonly equalizingPayment: EqualizingPayment;
  /** True when marital liabilities exceed marital assets (net estate < 0). */
  readonly negativeEstate: boolean;
}

/** The effect of one item flagged as excluded by written agreement. */
export interface ExcludedItemEffect {
  readonly id: string;
  readonly label: string;
  readonly category: EdCategory;
  readonly type: EdItemType;
  readonly valueCents: number;
  readonly owner: EdOwner;
  /** True only when a written agreement is confirmed to exist. */
  readonly honored: boolean;
  readonly reason: string;
}

/** An item set apart to its owner as nonmarital under §61.075(6)(b). */
export interface SetAsideItem {
  readonly id: string;
  readonly label: string;
  readonly category: EdCategory;
  readonly type: EdItemType;
  readonly valueCents: number;
  readonly owner: EdOwner;
  readonly basis: EdNonmaritalBasis;
  readonly basisCitation: string;
}

export interface NonmaritalSetAside {
  readonly items: readonly SetAsideItem[];
  readonly aAssetsCents: number;
  readonly aLiabilitiesCents: number;
  readonly aNetCents: number;
  readonly bAssetsCents: number;
  readonly bLiabilitiesCents: number;
  readonly bNetCents: number;
}

export interface EquitableDistributionResult {
  readonly partyALabel: string;
  readonly partyBLabel: string;
  readonly writtenAgreementConfirmed: boolean;
  readonly nonmaritalSetAside: NonmaritalSetAside;
  /** Distribution WITH any validly-excluded items removed from the estate. */
  readonly distributionWithExclusions: DistributionScenario;
  /** Baseline distribution as if NO written-agreement exclusion applied. */
  readonly baselineWithoutExclusions: DistributionScenario;
  /** Every excludedByWrittenAgreement item and whether it was honored. */
  readonly exclusions: readonly ExcludedItemEffect[];
  /** §61.075(1)(a)-(j) factors, for display only — never scored or weighted. */
  readonly unequalDistributionFactors: readonly UnequalDistributionFactor[];
}
