"use client";

import type { AssistantKind } from "@/lib/assistantKinds";

interface AssistantKindSelectorProps {
  value: AssistantKind;
  onChange: (kind: AssistantKind) => void;
  disabled?: boolean;
}

const OPTIONS: readonly { kind: AssistantKind; label: string; description: string }[] = [
  {
    kind: "legal",
    label: "Florida law",
    description: "Statute-grounded legal information",
  },
  {
    kind: "financial_options",
    label: "Financial options",
    description: "Compare funding, tax, liquidity, and risk factors",
  },
];

export function AssistantKindSelector({ value, onChange, disabled = false }: AssistantKindSelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">Choose which guide to ask</legend>
      <div className="grid grid-cols-2 gap-2" data-testid="assistant-kind-selector">
        {OPTIONS.map((option) => {
          const selected = option.kind === value;
          return (
            <button
              key={option.kind}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option.kind)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 ${
                selected
                  ? "border-primary bg-primary/10 text-ink"
                  : "border-border bg-surface text-ink-muted hover:bg-surface-hover"
              }`}
            >
              <span className="block text-xs font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug">{option.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
