import {
  calculateFloridaAlimony,
  calculateFloridaChildSupport,
  confirmFact,
  unwrapConfirmedFact,
  type AlimonyInput,
  type AlimonyResult,
  type ChildSupportInput,
  type ChildSupportResult,
  type RuleOutcome,
} from "@/domain/rules";
import type { ReviewedIntakeDraft } from "@/domain/intake";

import {
  mapReviewedDraftToAlimonyInput,
  mapReviewedDraftToChildSupportInput,
} from "@/domain/integration";

/**
 * "What if I earned nine thousand instead?"
 *
 * A what-if is the saved case with one or two numbers swapped. The swapped
 * numbers are not facts: nobody reviewed them, they are not part of the case,
 * and they must never end up in a draft or a package. But they still have to
 * be run through the *same* deterministic calculators, because the whole point
 * of the answer is that it is the real Florida arithmetic rather than a guess.
 *
 * That is what the `conversational-scenario` provenance is for. The override
 * is wrapped as a confirmed fact so the rules engine will accept it — the
 * engine takes nothing else — but stamped with a source that marks it as
 * hypothetical, so everything downstream can refuse to save or print it.
 *
 * Two deliberate limits:
 *
 * - Overrides are applied to the **calculator input**, not to the draft. An
 *   income override replaces one number, `monthlyGrossIncomeCents`. Applying
 *   it to the draft would mean inventing a breakdown across the statutory
 *   categories, and a fabricated split of someone's wages is a worse lie than
 *   no split at all. This is sound because only the *total* reaches the
 *   calculators; the categories exist for the package's citation list, and a
 *   scenario never reaches a package.
 * - Every applied override is echoed back in the result. A what-if is only
 *   honest if the person can see which number was changed and what it was
 *   changed from, especially when the number was read out of a sentence they
 *   typed.
 */

/** The `parentId` the app's own user is mapped to. Mirrors the child-support mapper. */
const SELF_PARENT_ID = "parent1" as const;

export interface ScenarioOverrides {
  /** Replaces the app user's total monthly gross income. */
  readonly selfMonthlyGrossIncomeCents?: number;
  /** Replaces the other party's total monthly gross income. */
  readonly spouseMonthlyGrossIncomeCents?: number;
  /** Replaces the app user's overnights per year; the other party gets the remainder. */
  readonly selfAnnualOvernights?: number;
}

/** One change, described so a person can check it against what they meant. */
export interface AppliedOverride {
  readonly field: keyof ScenarioOverrides;
  readonly label: string;
  /** The value from the saved case, before the what-if. */
  readonly fromCents?: number;
  readonly from?: number;
  readonly toCents?: number;
  readonly to?: number;
}

export interface ScenarioResult {
  /** Always true. Present so a caller cannot forget which kind of result this is. */
  readonly isHypothetical: true;
  readonly appliedOverrides: readonly AppliedOverride[];
  readonly childSupport: RuleOutcome<ChildSupportResult> | null;
  readonly alimony: RuleOutcome<AlimonyResult> | null;
  /** Reasons a topic could not be recalculated, in plain language. */
  readonly notes: readonly string[];
}

export class EmptyScenarioError extends Error {
  constructor() {
    super("A what-if needs at least one changed value; otherwise it is just the saved estimate.");
    this.name = "EmptyScenarioError";
  }
}

function hasAnyOverride(overrides: ScenarioOverrides): boolean {
  return (
    overrides.selfMonthlyGrossIncomeCents !== undefined ||
    overrides.spouseMonthlyGrossIncomeCents !== undefined ||
    overrides.selfAnnualOvernights !== undefined
  );
}

function applyToChildSupport(
  input: ChildSupportInput,
  overrides: ScenarioOverrides,
  applied: AppliedOverride[],
): ChildSupportInput {
  const parents = input.parents.map((parent) => ({ ...parent }));
  const selfIndex = parents.findIndex((parent) => parent.parentId === SELF_PARENT_ID);
  const otherIndex = selfIndex === 0 ? 1 : 0;

  if (overrides.selfMonthlyGrossIncomeCents !== undefined && selfIndex >= 0) {
    applied.push({
      field: "selfMonthlyGrossIncomeCents",
      label: "Your monthly gross income",
      fromCents: parents[selfIndex].monthlyGrossIncomeCents,
      toCents: overrides.selfMonthlyGrossIncomeCents,
    });
    parents[selfIndex].monthlyGrossIncomeCents = overrides.selfMonthlyGrossIncomeCents;
  }

  if (overrides.spouseMonthlyGrossIncomeCents !== undefined && selfIndex >= 0) {
    applied.push({
      field: "spouseMonthlyGrossIncomeCents",
      label: "Your spouse's monthly gross income",
      fromCents: parents[otherIndex].monthlyGrossIncomeCents,
      toCents: overrides.spouseMonthlyGrossIncomeCents,
    });
    parents[otherIndex].monthlyGrossIncomeCents = overrides.spouseMonthlyGrossIncomeCents;
  }

  if (overrides.selfAnnualOvernights !== undefined && selfIndex >= 0) {
    applied.push({
      field: "selfAnnualOvernights",
      label: "Your overnights per year",
      from: parents[selfIndex].overnightsWithChild,
      to: overrides.selfAnnualOvernights,
    });
    parents[selfIndex].overnightsWithChild = overrides.selfAnnualOvernights;
    // The nights in a year are fixed, so moving one parent's overnights moves
    // the other's by the same amount. Leaving the other untouched would
    // silently invent or destroy nights and trip the schema's own check.
    parents[otherIndex].overnightsWithChild = Math.max(
      0,
      input.totalNightsInPeriod - overrides.selfAnnualOvernights,
    );
  }

  return { ...input, parents: [parents[0], parents[1]] };
}

function applyToAlimony(
  input: AlimonyInput,
  overrides: ScenarioOverrides,
  reviewed: ReviewedIntakeDraft,
): AlimonyInput {
  // Alimony names the parties by role, not by whose app this is, so the
  // override has to follow the same mapping the alimony mapper used.
  const recipientIsSelf = reviewed.data.alimonyFactors.potentialAlimonyRecipient === "self";
  const selfKey = recipientIsSelf ? "obligee" : "payor";
  const spouseKey = recipientIsSelf ? "payor" : "obligee";

  const next: AlimonyInput = { ...input, payor: { ...input.payor }, obligee: { ...input.obligee } };

  if (overrides.selfMonthlyGrossIncomeCents !== undefined) {
    next[selfKey] = { ...next[selfKey], monthlyGrossIncomeCents: overrides.selfMonthlyGrossIncomeCents };
  }
  if (overrides.spouseMonthlyGrossIncomeCents !== undefined) {
    next[spouseKey] = {
      ...next[spouseKey],
      monthlyGrossIncomeCents: overrides.spouseMonthlyGrossIncomeCents,
    };
  }

  return next;
}

/**
 * Recalculates child support and alimony with the given values swapped in.
 *
 * Nothing here writes: the caller gets a value back and the saved case is
 * untouched.
 */
export function calculateScenario(
  reviewed: ReviewedIntakeDraft,
  overrides: ScenarioOverrides,
): ScenarioResult {
  if (!hasAnyOverride(overrides)) throw new EmptyScenarioError();

  const applied: AppliedOverride[] = [];
  const notes: string[] = [];

  const childSupportMapping = mapReviewedDraftToChildSupportInput(reviewed);
  let childSupport: RuleOutcome<ChildSupportResult> | null = null;
  if (childSupportMapping.kind === "mapped") {
    const base = unwrapConfirmedFact(childSupportMapping.value);
    const withOverrides = applyToChildSupport(base, overrides, applied);
    childSupport = calculateFloridaChildSupport(
      confirmFact(withOverrides, "conversational-scenario", reviewed.reviewedAt),
    );
  } else {
    notes.push(
      "Child support was not recalculated because the saved answers do not support a calculation yet.",
    );
  }

  const alimonyMapping = mapReviewedDraftToAlimonyInput(reviewed);
  let alimony: RuleOutcome<AlimonyResult> | null = null;
  if (alimonyMapping.kind === "mapped") {
    const base = unwrapConfirmedFact(alimonyMapping.value);
    const withOverrides = applyToAlimony(base, overrides, reviewed);
    alimony = calculateFloridaAlimony(
      confirmFact(withOverrides, "conversational-scenario", reviewed.reviewedAt),
    );
  } else {
    notes.push("Alimony was not recalculated because the saved answers do not support a calculation yet.");
  }

  // Income changes reach alimony too, but the echo list is built while walking
  // the child-support input. When there is no such walk the changes are
  // recorded here instead — a person must always be able to see what changed.
  if (childSupportMapping.kind !== "mapped") {
    if (overrides.selfMonthlyGrossIncomeCents !== undefined) {
      applied.push({
        field: "selfMonthlyGrossIncomeCents",
        label: "Your monthly gross income",
        toCents: overrides.selfMonthlyGrossIncomeCents,
      });
    }
    if (overrides.spouseMonthlyGrossIncomeCents !== undefined) {
      applied.push({
        field: "spouseMonthlyGrossIncomeCents",
        label: "Your spouse's monthly gross income",
        toCents: overrides.spouseMonthlyGrossIncomeCents,
      });
    }
    if (overrides.selfAnnualOvernights !== undefined) {
      notes.push("Overnights were ignored because this case has no child-support calculation.");
    }
  }

  return { isHypothetical: true, appliedOverrides: applied, childSupport, alimony, notes };
}
