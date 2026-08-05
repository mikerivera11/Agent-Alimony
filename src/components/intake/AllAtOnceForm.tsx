"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getApplicableStepIds,
  getStepDefaultValues,
  INTAKE_STEPS,
  type IntakeDraftData,
  type IntakeStepId,
} from "@/domain/intake";

import { Alert } from "@/components/ui";
import { primaryButtonClasses, secondaryButtonClasses } from "./fields/inputStyles";
import { IntakeSection, type IntakeSectionHandle } from "./IntakeSection";

/** Long enough not to write on every keystroke, short enough to survive a stray refresh. */
const AUTOSAVE_DELAY_MS = 800;

interface AllAtOnceFormProps {
  data: IntakeDraftData;
  /** Saves partial, unvalidated answers so nothing is lost on a long page. */
  onSaveProgress: (values: Partial<Record<IntakeStepId, Record<string, unknown>>>) => void;
  /** Called only when every applicable section validates. */
  onComplete: (values: Record<IntakeStepId, Record<string, unknown>>) => void;
}

/**
 * The whole intake on a single page, for people who would rather see
 * everything at once than move through one topic at a time.
 *
 * This is a different presentation of the same intake, not a shortcut around
 * it: identical schemas, identical field components, and the same review step
 * afterwards. Nothing reaches a calculation without passing the same
 * validation the guided wizard applies.
 */
export function AllAtOnceForm({ data, onSaveProgress, onComplete }: AllAtOnceFormProps) {
  const handles = useRef(new Map<IntakeStepId, IntakeSectionHandle>());
  const liveValues = useRef<Partial<Record<IntakeStepId, Record<string, unknown>>>>({});
  const [applicableStepIds, setApplicableStepIds] = useState<IntakeStepId[]>(() =>
    getApplicableStepIds(data),
  );
  const [invalidStepIds, setInvalidStepIds] = useState<IntakeStepId[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleValuesChange = useCallback(
    (stepId: IntakeStepId, values: Record<string, unknown>) => {
      liveValues.current[stepId] = values;

      // Autosave. On a page this long, losing work to a stray refresh or a
      // layout switch would be far worse than an extra write to localStorage,
      // so don't rely on anyone pressing "Save progress".
      if (autosaveTimer.current !== null) {
        clearTimeout(autosaveTimer.current);
      }
      autosaveTimer.current = setTimeout(() => {
        onSaveProgress({ ...liveValues.current });
        setSavedAt(new Date().toISOString());
      }, AUTOSAVE_DELAY_MS);

      // Answering "do you have children?" adds or removes whole sections. Work
      // this out from the live values rather than the last saved draft, so the
      // page reacts as soon as the answer changes instead of after a save.
      const merged = { ...data } as IntakeDraftData;
      for (const [id, sectionValues] of Object.entries(liveValues.current)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- values already scoped to their own topic
        (merged as any)[id] = sectionValues;
      }
      const next = getApplicableStepIds(merged);
      setApplicableStepIds((current) =>
        current.length === next.length && current.every((id, index) => id === next[index])
          ? current
          : next,
      );
    },
    [data, onSaveProgress],
  );

  useEffect(() => {
    return () => {
      if (autosaveTimer.current !== null) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  const registerHandle = useCallback((stepId: IntakeStepId) => {
    return (handle: IntakeSectionHandle | null) => {
      if (handle) {
        handles.current.set(stepId, handle);
      } else {
        handles.current.delete(stepId);
      }
    };
  }, []);

  function collectLiveValues() {
    const collected: Partial<Record<IntakeStepId, Record<string, unknown>>> = {};
    for (const stepId of applicableStepIds) {
      const handle = handles.current.get(stepId);
      if (handle) {
        collected[stepId] = handle.getValues();
      }
    }
    return collected;
  }

  function handleSaveProgress() {
    onSaveProgress(collectLiveValues());
    setSavedAt(new Date().toISOString());
  }

  async function handleCheckAndReview() {
    setIsChecking(true);
    try {
      // Save first. If validation sends someone back to fix three sections,
      // their other answers should already be safe.
      onSaveProgress(collectLiveValues());

      const results = await Promise.all(
        applicableStepIds.map(async (stepId) => {
          const handle = handles.current.get(stepId);
          if (!handle) return { stepId, values: null };
          return { stepId, values: await handle.validate() };
        }),
      );

      const invalid = results.filter((result) => result.values === null).map((result) => result.stepId);
      setInvalidStepIds(invalid);

      if (invalid.length > 0) {
        const first = invalid[0];
        document.getElementById(`section-${first}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        handles.current.get(first)?.focus();
        return;
      }

      const values = {} as Record<IntakeStepId, Record<string, unknown>>;
      for (const result of results) {
        if (result.values) {
          values[result.stepId] = result.values;
        }
      }
      onComplete(values);
    } finally {
      setIsChecking(false);
    }
  }

  const sectionDefaults = useMemo(() => {
    const defaults = new Map<IntakeStepId, Record<string, unknown>>();
    for (const stepId of applicableStepIds) {
      defaults.set(stepId, {
        ...(getStepDefaultValues(stepId, data) as Record<string, unknown>),
        ...data[stepId],
      });
    }
    return defaults;
  }, [applicableStepIds, data]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Everything on one page
        </h1>
        <p className="text-lg text-ink-muted">
          All {applicableStepIds.length} sections are below. Fill them in any order, save whenever you
          like, and check everything at the end. Your answers are saved on this device only.
        </p>
      </div>

      <Alert variant="info" role="note" className="text-sm">
        Nothing is skipped by working this way — the questions, the rules, and the review step are
        identical to the step-by-step guide. If a question is unclear, the &quot;Why we ask&quot; note at
        the top of each section explains it.
      </Alert>

      {invalidStepIds.length > 0 ? (
        <Alert variant="danger" emphasis role="alert" title="Some answers still need attention">
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
            {invalidStepIds.map((stepId) => (
              <li key={stepId}>
                <button
                  type="button"
                  onClick={() => {
                    document
                      .getElementById(`section-${stepId}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    handles.current.get(stepId)?.focus();
                  }}
                  className="rounded font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {INTAKE_STEPS[stepId].title}
                </button>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {applicableStepIds.map((stepId, index) => (
        <IntakeSection
          key={stepId}
          ref={registerHandle(stepId)}
          stepId={stepId}
          defaultValues={sectionDefaults.get(stepId) ?? {}}
          position={index + 1}
          total={applicableStepIds.length}
          onValuesChange={handleValuesChange}
        />
      ))}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-border bg-surface/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:border">
        <p role="status" className="text-sm text-ink-muted">
          {savedAt
            ? `Saved automatically at ${new Date(savedAt).toLocaleTimeString()}.`
            : "Your answers save automatically as you type."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleSaveProgress} className={secondaryButtonClasses}>
            Save progress
          </button>
          <button
            type="button"
            onClick={handleCheckAndReview}
            disabled={isChecking}
            className={primaryButtonClasses}
          >
            {isChecking ? "Checking…" : "Check answers and review"}
          </button>
        </div>
      </div>
    </div>
  );
}
