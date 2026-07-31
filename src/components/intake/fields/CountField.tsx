"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldWrapper, useFieldDescribedBy } from "./FieldWrapper";
import { textInputClasses } from "./inputStyles";

interface CountFieldProps {
  id: string;
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  registration: UseFormRegisterReturn;
  max?: number;
}

/** A whole-number input, e.g. overnights per year. Blank is treated as 0. */
export function CountField({ id, label, hint, example, error, required, registration, max }: CountFieldProps) {
  return (
    <FieldWrapper id={id} label={label} hint={hint} example={example} error={error} required={required}>
      <CountInput id={id} registration={registration} error={error} max={max} />
    </FieldWrapper>
  );
}

function CountInput({
  id,
  registration,
  error,
  max,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
  max?: number;
}) {
  const describedBy = useFieldDescribedBy();
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      step="1"
      min="0"
      max={max}
      placeholder="0"
      className={textInputClasses}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
      {...registration}
    />
  );
}
