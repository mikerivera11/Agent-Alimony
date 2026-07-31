"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldWrapper, useFieldDescribedBy } from "./FieldWrapper";
import { textInputClasses } from "./inputStyles";

interface PercentFieldProps {
  id: string;
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  registration: UseFormRegisterReturn;
  /** Defaults to 0. Set negative to allow a decline, e.g. a falling market. */
  min?: number;
  max?: number;
}

/**
 * A percentage input, entered as a whole percent ("3.5" means 3.5%).
 *
 * Callers convert to basis points before calling any calculation, so the
 * displayed unit and the computed unit never drift.
 */
export function PercentField({
  id,
  label,
  hint,
  example,
  error,
  required,
  registration,
  min = 0,
  max = 100,
}: PercentFieldProps) {
  return (
    <FieldWrapper id={id} label={label} hint={hint} example={example} error={error} required={required}>
      <PercentInput id={id} registration={registration} error={error} min={min} max={max} />
    </FieldWrapper>
  );
}

function PercentInput({
  id,
  registration,
  error,
  min,
  max,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
  min: number;
  max: number;
}) {
  const describedBy = useFieldDescribedBy();
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.1"
        min={min}
        max={max}
        placeholder="0"
        className={`${textInputClasses} pr-8 tabular-nums`}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        {...registration}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
      >
        %
      </span>
    </div>
  );
}
