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
  HouseholdExpenses,
  Income,
  Marriage,
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
  isDemo: boolean;
  data: {
    caseBasics: CaseBasics;
    marriage: Marriage;
    spouses: Spouses;
    children: Children;
    /** Undefined when the household has no shared minor children. */
    parentingTime: ParentingTime | undefined;
    income: Income;
    deductions: Deductions;
    /** Undefined when the household has no shared minor children. */
    childCosts: ChildCosts | undefined;
    householdExpenses: HouseholdExpenses;
    assetsDebts: AssetsDebts;
    alimonyFactors: AlimonyFactors;
    safetyComplexity: SafetyComplexity;
    documentReadiness: DocumentReadiness;
  };
}

export class DraftNotReadyError extends Error {
  constructor() {
    super("Cannot build a reviewed draft while required topics are still incomplete.");
    this.name = "DraftNotReadyError";
  }
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
    isDemo: draft.isDemo,
    data: {
      caseBasics: parseStep("caseBasics", draft.data),
      marriage: parseStep("marriage", draft.data),
      spouses: parseStep("spouses", draft.data),
      children: parseStep("children", draft.data),
      parentingTime: applicable.has("parentingTime") ? parseStep("parentingTime", draft.data) : undefined,
      income: parseStep("income", draft.data),
      deductions: parseStep("deductions", draft.data),
      childCosts: applicable.has("childCosts") ? parseStep("childCosts", draft.data) : undefined,
      householdExpenses: parseStep("householdExpenses", draft.data),
      assetsDebts: parseStep("assetsDebts", draft.data),
      alimonyFactors: parseStep("alimonyFactors", draft.data),
      safetyComplexity: parseStep("safetyComplexity", draft.data),
      documentReadiness: parseStep("documentReadiness", draft.data),
    },
  };
}
