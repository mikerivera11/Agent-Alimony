interface ProgressIndicatorProps {
  steps: { id: string; title: string }[];
  currentStepId: string;
  completedStepIds: string[];
}

/**
 * Shows overall progress through the wizard: a numeric "Step X of N" status
 * (announced to screen readers via `aria-live`), a visual progress bar, and
 * an ordered list of every topic with its completion state.
 */
export function ProgressIndicator({ steps, currentStepId, completedStepIds }: ProgressIndicatorProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStepId),
  );
  const percent = steps.length > 0 ? Math.round(((currentIndex + 1) / steps.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="text-sm font-medium text-slate-700">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.title}
      </p>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall progress"
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-blue-800 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <nav aria-label="Intake topics">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStepId;
            const isComplete = completedStepIds.includes(step.id);
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? "step" : undefined}
                className={isCurrent ? "font-semibold text-blue-900" : undefined}
              >
                {isComplete ? <span aria-hidden="true">✓ </span> : null}
                {index + 1}. {step.title}
                {isComplete ? <span className="sr-only"> (complete)</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
