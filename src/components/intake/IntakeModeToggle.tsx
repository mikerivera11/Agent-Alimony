"use client";

import type { IntakeMode } from "@/domain/intake";

interface IntakeModeToggleProps {
  mode: IntakeMode;
  onChange: (mode: IntakeMode) => void;
}

const OPTIONS: ReadonlyArray<{ value: IntakeMode; label: string; hint: string }> = [
  {
    value: "guided",
    label: "Step by step",
    hint: "One topic at a time, with guidance",
  },
  {
    value: "allAtOnce",
    label: "All on one page",
    hint: "Every question at once, fill in any order",
  },
];

/**
 * Lets someone choose how to work through the intake. Answers already entered
 * carry across, because both modes read and write the same draft.
 */
export function IntakeModeToggle({ mode, onChange }: IntakeModeToggleProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend id="intake-mode-legend" className="text-sm font-semibold text-ink">
        How would you like to fill this in?
      </legend>
      <div role="radiogroup" aria-labelledby="intake-mode-legend" className="flex flex-col gap-2 sm:flex-row">
        {OPTIONS.map((option) => {
          const isActive = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(option.value)}
              className={`flex flex-1 flex-col items-start gap-0.5 rounded-xl border-2 px-4 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                isActive
                  ? "border-accent bg-accent-surface text-accent-text"
                  : "border-border bg-surface text-ink hover:border-accent/50"
              }`}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs text-ink-muted">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
