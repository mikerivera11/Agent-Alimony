"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldWrapper, useFieldDescribedBy } from "./FieldWrapper";
import { textInputClasses } from "./inputStyles";

interface DateFieldProps {
  id: string;
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  registration: UseFormRegisterReturn;
}

export function DateField({ id, label, hint, example, error, required, registration }: DateFieldProps) {
  return (
    <FieldWrapper id={id} label={label} hint={hint} example={example} error={error} required={required}>
      <DateInput id={id} registration={registration} error={error} />
    </FieldWrapper>
  );
}

function DateInput({ id, registration, error }: { id: string; registration: UseFormRegisterReturn; error?: string }) {
  const describedBy = useFieldDescribedBy();
  return (
    <input
      id={id}
      type="date"
      className={textInputClasses}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
      {...registration}
    />
  );
}
