import { INTAKE_STEPS, INTAKE_STEP_ORDER, getApplicableStepIds } from "./steps";
import type { IntakeDraft, IntakeDraftData, IntakeStepId } from "./draft";

export interface StepCompletionResult {
  stepId: IntakeStepId;
  isComplete: boolean;
  /** Human-readable validation messages for anything missing or invalid. */
  issues: string[];
}

/**
 * Runs a topic's Zod schema against the (partial) answers stored for it and
 * reports whether it's complete, plus plain messages for whatever isn't.
 */
export function checkStepCompletion(stepId: IntakeStepId, data: IntakeDraftData): StepCompletionResult {
  const step = INTAKE_STEPS[stepId];
  const stepData = data[stepId];
  const result = step.schema.safeParse(stepData);

  if (result.success) {
    return { stepId, isComplete: true, issues: [] };
  }

  const issues = result.error.issues.map((issue) => {
    const fieldPath = issue.path.join(".");
    return fieldPath ? `${fieldPath}: ${issue.message}` : issue.message;
  });

  return { stepId, isComplete: false, issues };
}

export interface MissingDataSummaryEntry {
  stepId: IntakeStepId;
  title: string;
  issues: string[];
}

/**
 * Builds the "here's what's still missing" summary shown on the review
 * screen, skipping any topic that doesn't apply (e.g. parenting time when
 * there are no children).
 */
export function getMissingDataSummary(draft: IntakeDraft): MissingDataSummaryEntry[] {
  const applicableStepIds = getApplicableStepIds(draft.data);

  return INTAKE_STEP_ORDER.filter((id) => applicableStepIds.includes(id))
    .map((stepId) => {
      const completion = checkStepCompletion(stepId, draft.data);
      if (completion.isComplete) {
        return null;
      }
      return {
        stepId,
        title: INTAKE_STEPS[stepId].title,
        issues: completion.issues,
      } satisfies MissingDataSummaryEntry;
    })
    .filter((entry): entry is MissingDataSummaryEntry => entry !== null);
}

/** True once every applicable topic in the draft is complete. */
export function isDraftReadyForReview(draft: IntakeDraft): boolean {
  return getMissingDataSummary(draft).length === 0;
}
