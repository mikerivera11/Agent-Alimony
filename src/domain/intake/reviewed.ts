import { INTAKE_STEPS, getApplicableStepIds } from "./steps";
import { isDraftReadyForReview } from "./missingData";
import type { IntakeDraft, IntakeDraftData, IntakeStepId } from "./draft";
import type {
  AlimonyFactors,
  AssetsDebts,
  CaseBasics,
  ChildCosts,
  Children,
  Deductions,
  DocumentReadiness,
  FilingDetails,
  HouseholdExpenses,
  Income,
  Marriage,
  ParentingPlan,
  ParentingTime,
  SafetyComplexity,
  Spouses,
} from "./schema";

/**
 * The fully-validated shape of a finished intake, ready to hand off to
 * whatever consumes it next (a calculation engine, a server API, a PDF
 * generator, etc). Every field is now guaranteed present and valid — this is
 * intentionally *not* a partial type. This module does not perform any
 * calculation or persistence itself; it only validates and reshapes data
 * that already lives in the wizard's draft.
 */
export interface ReviewedIntakeDraft {
  draftId: string;
  reviewedAt: string;
  data: {
    caseBasics: CaseBasics;
    marriage: Marriage;
    spouses: Spouses;
    children: Children;
    /** Undefined when the household has no shared minor children. */
    parentingTime: ParentingTime | undefined;
    /** Undefined when the household has no shared minor children. */
    parentingPlan: ParentingPlan | undefined;
    income: Income;
    deductions: Deductions;
    /** Undefined when the household has no shared minor children. */
    childCosts: ChildCosts | undefined;
    householdExpenses: HouseholdExpenses;
    assetsDebts: AssetsDebts;
    alimonyFactors: AlimonyFactors;
    safetyComplexity: SafetyComplexity;
    documentReadiness: DocumentReadiness;
    filingDetails: FilingDetails;
  };
}

export class DraftNotReadyError extends Error {
  constructor() {
    super("Cannot build a reviewed draft while required topics are still incomplete.");
    this.name = "DraftNotReadyError";
  }
}

/**
 * True when answers have changed since the reviewed snapshot was confirmed,
 * which means any estimate built from that snapshot no longer reflects what
 * the person has entered.
 *
 * This is a correctness guard, not a nicety: the results screen and the PDF
 * are both built from the frozen snapshot, so without this check a person
 * could edit their income, return to `/results`, and download a package whose
 * figures silently contradict their own answers.
 *
 * Only `updatedAt` (an answer changed) is compared — navigating between
 * screens deliberately leaves it alone.
 */
export function isReviewedSnapshotStale(
  reviewed: Pick<ReviewedIntakeDraft, "draftId" | "reviewedAt"> | null,
  draft: Pick<IntakeDraft, "draftId" | "updatedAt"> | null,
): boolean {
  if (!reviewed || !draft) {
    return false;
  }
  // A different draft entirely (e.g. "Start over" created a new one) means the
  // snapshot describes answers that no longer exist.
  if (reviewed.draftId !== draft.draftId) {
    return true;
  }
  const reviewedAt = Date.parse(reviewed.reviewedAt);
  const updatedAt = Date.parse(draft.updatedAt);
  if (Number.isNaN(reviewedAt) || Number.isNaN(updatedAt)) {
    // An unparseable timestamp means we cannot prove the estimate is current,
    // so treat it as stale rather than showing figures we cannot vouch for.
    return true;
  }
  return updatedAt > reviewedAt;
}

function parseStep<K extends IntakeStepId>(stepId: K, data: IntakeDraftData) {
  const result = INTAKE_STEPS[stepId].schema.safeParse(data[stepId]);
  if (!result.success) {
    throw new DraftNotReadyError();
  }
  return result.data;
}

/**
 * Validates every applicable topic and returns a fully-typed, non-partial
 * snapshot of the draft. Throws `DraftNotReadyError` if anything required is
 * still missing — callers (e.g. the review screen) should check
 * `isDraftReadyForReview` first and only call this once that's true.
 */
export function buildReviewedDraft(draft: IntakeDraft): ReviewedIntakeDraft {
  if (!isDraftReadyForReview(draft)) {
    throw new DraftNotReadyError();
  }

  const applicable = new Set(getApplicableStepIds(draft.data));

  return {
    draftId: draft.draftId,
    reviewedAt: new Date().toISOString(),
    data: {
      caseBasics: parseStep("caseBasics", draft.data),
      marriage: parseStep("marriage", draft.data),
      spouses: parseStep("spouses", draft.data),
      children: parseStep("children", draft.data),
      parentingTime: applicable.has("parentingTime") ? parseStep("parentingTime", draft.data) : undefined,
      parentingPlan: applicable.has("parentingPlan") ? parseStep("parentingPlan", draft.data) : undefined,
      income: parseStep("income", draft.data),
      deductions: parseStep("deductions", draft.data),
      childCosts: applicable.has("childCosts") ? parseStep("childCosts", draft.data) : undefined,
      householdExpenses: parseStep("householdExpenses", draft.data),
      assetsDebts: parseStep("assetsDebts", draft.data),
      alimonyFactors: parseStep("alimonyFactors", draft.data),
      safetyComplexity: parseStep("safetyComplexity", draft.data),
      documentReadiness: parseStep("documentReadiness", draft.data),
      filingDetails: parseStep("filingDetails", draft.data),
    },
  };
}
