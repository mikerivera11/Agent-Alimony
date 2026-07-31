"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  assessEscalation,
  buildReviewedDraft,
  createEmptyDraft,
  getApplicableStepIds,
  getMissingDataSummary,
  getIntakeModeServerSnapshot,
  getIntakeModeSnapshot,
  isDraftReadyForReview,
  setIntakeMode,
  structuredCloneDraftData,
  subscribeIntakeMode,
  type IntakeDraft,
  type IntakeDraftStorage,
  type IntakeMode,
  type IntakeStepId,
  type ReviewedIntakeDraft,
} from "@/domain/intake";
import { INTAKE_STEPS } from "@/domain/intake";

import { AllAtOnceForm } from "./AllAtOnceForm";
import { AttorneyEscalationNotice } from "./AttorneyEscalationNotice";
import { DemoBanner } from "./DemoBanner";
import { primaryButtonClasses, secondaryButtonClasses } from "./fields/inputStyles";
import { IntakeModeToggle } from "./IntakeModeToggle";
import { MissingDataSummary } from "./MissingDataSummary";
import { ProgressIndicator } from "./ProgressIndicator";
import { QuickExitLink } from "./QuickExitLink";
import { ReviewSummary } from "./ReviewSummary";
import { StepForm } from "./StepForm";
import { Alert, Card } from "@/components/ui";

type WizardScreen = IntakeStepId | "review" | "done";

interface IntakeWizardProps {
  storage: IntakeDraftStorage;
  /** When provided (e.g. the demo), used instead of whatever is in storage. */
  initialDraft?: IntakeDraft;
  /** Called once the person confirms their reviewed answers. No calculation happens here. */
  onReviewComplete?: (draft: ReviewedIntakeDraft) => void;
}

/**
 * The full guided intake experience: loads or creates a draft, walks through
 * one topic at a time, and finishes on a review screen with a missing-data
 * summary and attorney/safety flags. All persistence goes through the
 * `storage` adapter — nothing here talks to a server.
 */
export function IntakeWizard({ storage, initialDraft, onReviewComplete }: IntakeWizardProps) {
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [screen, setScreen] = useState<WizardScreen>("caseBasics");
  const mode = useSyncExternalStore(
    subscribeIntakeMode,
    getIntakeModeSnapshot,
    getIntakeModeServerSnapshot,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (initialDraft) {
        if (!cancelled) {
          setDraft(initialDraft);
          setIsLoading(false);
        }
        void storage.save(initialDraft);
        return;
      }
      const loaded = await storage.load();
      if (cancelled) return;
      setDraft(loaded ?? createEmptyDraft());
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [storage, initialDraft]);

  if (isLoading || !draft) {
    return (
      <p role="status" className="p-6 text-lg text-ink-muted">
        Loading your saved answers…
      </p>
    );
  }

  const applicableStepIds = getApplicableStepIds(draft.data);
  const progressSteps = applicableStepIds.map((id) => ({ id, title: INTAKE_STEPS[id].title }));
  const displaySteps = [...progressSteps, { id: "review", title: "Review" }];
  const currentDisplayStepId = screen === "review" || screen === "done" ? "review" : screen;
  const escalation = assessEscalation(draft.data);

  function persist(nextDraft: IntakeDraft) {
    setDraft(nextDraft);
    void storage.save(nextDraft);
  }

  function handleStepSubmit(stepId: IntakeStepId, values: Record<string, unknown>) {
    if (!draft) return;
    const nextData = structuredCloneDraftData(draft.data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- values already validated against this step's schema
    (nextData as any)[stepId] = values;
    const nextCompleted = draft.completedStepIds.includes(stepId)
      ? draft.completedStepIds
      : [...draft.completedStepIds, stepId];

    const nextDraft: IntakeDraft = {
      ...draft,
      data: nextData,
      completedStepIds: nextCompleted,
      updatedAt: new Date().toISOString(),
    };
    persist(nextDraft);

    const applicableAfter = getApplicableStepIds(nextData);
    const currentIndex = applicableAfter.indexOf(stepId);
    const next = applicableAfter[currentIndex + 1];
    setScreen(next ?? "review");
  }

  function goToStep(stepId: IntakeStepId) {
    setScreen(stepId);
  }

  function handleBack(stepId: IntakeStepId) {
    const index = applicableStepIds.indexOf(stepId);
    const previous = applicableStepIds[index - 1];
    if (previous) {
      setScreen(previous);
    }
  }

  function handleStartOver() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("This clears every answer saved on this device. Continue?");
      if (!confirmed) return;
    }
    void storage.clear();
    const fresh = createEmptyDraft();
    setDraft(fresh);
    setScreen("caseBasics");
    setConfirmedAt(null);
  }

  function handleConfirm() {
    if (!draft || !isDraftReadyForReview(draft)) return;
    const reviewed = buildReviewedDraft(draft);
    setConfirmedAt(reviewed.reviewedAt);
    onReviewComplete?.(reviewed);
    setScreen("done");
  }

  function handleModeChange(nextMode: IntakeMode) {
    setIntakeMode(nextMode);
    if (nextMode !== "guided" || screen === "review" || screen === "done") return;
    // Answers given on the one-page layout can retire the topic the guided
    // flow was sitting on — saying "no children" removes parenting time — so
    // returning to a step that no longer applies has to be corrected here.
    if (!applicableStepIds.includes(screen)) {
      setScreen(applicableStepIds[0] ?? "caseBasics");
    }
  }

  /**
   * Saves whatever is typed on the all-at-once page without validating it.
   * Every topic is stored as a Partial, so incomplete answers are safe to
   * keep — and a long page is exactly where losing work would hurt most.
   */
  function handleSaveAllProgress(values: Partial<Record<IntakeStepId, Record<string, unknown>>>) {
    if (!draft) return;
    const nextData = structuredCloneDraftData(draft.data);
    for (const [stepId, stepValues] of Object.entries(values)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- values are already scoped to their own topic
      (nextData as any)[stepId] = stepValues;
    }
    persist({ ...draft, data: nextData, updatedAt: new Date().toISOString() });
  }

  /**
   * Every applicable section passed its own schema. Mark those topics complete
   * and go to the same review screen the guided flow uses — the one-page form
   * changes the layout, not what has to be true before calculating.
   */
  function handleAllAtOnceComplete(values: Record<IntakeStepId, Record<string, unknown>>) {
    if (!draft) return;
    const nextData = structuredCloneDraftData(draft.data);
    const completed = new Set(draft.completedStepIds);
    for (const [stepId, stepValues] of Object.entries(values)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- values are already scoped to their own topic
      (nextData as any)[stepId] = stepValues;
      completed.add(stepId as IntakeStepId);
    }
    persist({
      ...draft,
      data: nextData,
      completedStepIds: [...completed],
      updatedAt: new Date().toISOString(),
    });
    setScreen("review");
  }

  const missingDataSummary = getMissingDataSummary(draft);

  return (
    <div className="flex flex-col gap-6">
      <Card padding="sm" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          {mode === "guided" ? (
            <ProgressIndicator
              steps={displaySteps}
              currentStepId={currentDisplayStepId}
              completedStepIds={draft.completedStepIds}
            />
          ) : (
            <p className="text-sm font-medium text-ink-muted">
              {screen === "review" || screen === "done"
                ? "Review"
                : `${applicableStepIds.length} sections on one page`}
            </p>
          )}
          <div className="flex flex-none items-center gap-2">
            <QuickExitLink />
          </div>
        </div>
        {screen !== "review" && screen !== "done" ? (
          <IntakeModeToggle mode={mode} onChange={handleModeChange} />
        ) : null}
      </Card>

      {draft.isDemo ? <DemoBanner onExitDemo={handleStartOver} /> : null}

      {escalation.safetyConcern ? (
        <Alert variant="danger" emphasis role="alert" title="Your safety comes first.">
          <p className="text-sm">
            If you are in danger, call 911. The National Domestic Violence Hotline is available any time at{" "}
            <a href="tel:18007997233" className="font-semibold underline">
              1-800-799-7233
            </a>
            . Use &quot;Quick exit&quot; above to leave this site immediately.
          </p>
        </Alert>
      ) : null}

      {screen === "done" ? (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-success-border bg-success-surface p-6 text-success-text">
          <h1 className="text-2xl font-bold">Your answers are saved</h1>
          <p>
            Everything you entered is saved on this device (as of {confirmedAt ? new Date(confirmedAt).toLocaleString() : "now"}
            ). Your confirmed facts are being prepared for the transparent calculation results.
          </p>
          <AttorneyEscalationNotice assessment={escalation} />
          <button type="button" onClick={() => setScreen("review")} className={secondaryButtonClasses}>
            Back to review
          </button>
        </div>
      ) : screen === "review" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Review your answers</h1>
            <p className="text-lg text-ink-muted">
              Check everything below before finishing. You can edit any topic.
            </p>
          </div>
          <MissingDataSummary entries={missingDataSummary} onEdit={goToStep} />
          <AttorneyEscalationNotice assessment={escalation} />
          <ReviewSummary data={draft.data} applicableStepIds={applicableStepIds} onEdit={goToStep} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={handleStartOver} className={secondaryButtonClasses}>
              Start over
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={missingDataSummary.length > 0}
              className={primaryButtonClasses}
            >
              Confirm and finish
            </button>
          </div>
        </div>
      ) : mode === "allAtOnce" ? (
        <AllAtOnceForm
          data={draft.data}
          onSaveProgress={handleSaveAllProgress}
          onComplete={handleAllAtOnceComplete}
        />
      ) : (
        <StepForm
          key={screen}
          stepId={screen}
          defaultValues={{ ...INTAKE_STEPS[screen].defaultValues, ...draft.data[screen] }}
          onSubmit={handleStepSubmit}
          onBack={() => handleBack(screen)}
          showBack={applicableStepIds.indexOf(screen) > 0}
          isLastStep={applicableStepIds.indexOf(screen) === applicableStepIds.length - 1}
        />
      )}

      {screen !== "review" && screen !== "done" ? (
        <div className="pt-2">
          <button type="button" onClick={handleStartOver} className="rounded text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
            Clear saved answers and start over
          </button>
        </div>
      ) : null}
    </div>
  );
}
