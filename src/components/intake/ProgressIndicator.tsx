import { Progress } from "@/components/ui";

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
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p aria-live="polite" className="text-sm font-semibold text-ink">
          Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.title}
        </p>
        <span aria-hidden="true" className="text-sm font-medium tabular-nums text-ink-subtle">
          {percent}%
        </span>
      </div>
      <Progress value={percent} label="Overall progress" />
      <nav aria-label="Intake topics">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-subtle">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStepId;
            const isComplete = completedStepIds.includes(step.id);
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? "step" : undefined}
                className={
                  isCurrent
                    ? "font-semibold text-primary"
                    : isComplete
                      ? "text-success-solid"
                      : undefined
                }
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
