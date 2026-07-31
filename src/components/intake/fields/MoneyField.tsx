"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldWrapper, useFieldDescribedBy } from "./FieldWrapper";
import { textInputClasses } from "./inputStyles";

interface MoneyFieldProps {
  id: string;
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  registration: UseFormRegisterReturn;
  /** Shown after the label, e.g. "per month". */
  cadenceLabel?: string;
}

/** A dollar-amount input. Blank is treated as $0 by the underlying schema. */
export function MoneyField({ id, label, hint, example, error, required, registration, cadenceLabel }: MoneyFieldProps) {
  return (
    <FieldWrapper
      id={id}
      label={cadenceLabel ? `${label} (${cadenceLabel})` : label}
      hint={hint}
      example={example}
      error={error}
      required={required}
    >
      <MoneyInput id={id} registration={registration} error={error} />
    </FieldWrapper>
  );
}

function MoneyInput({
  id,
  registration,
  error,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const describedBy = useFieldDescribedBy();
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle">
        $
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0"
        className={`${textInputClasses} pl-7 tabular-nums`}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        {...registration}
      />
    </div>
  );
}
