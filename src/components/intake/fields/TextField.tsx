"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldWrapper, useFieldDescribedBy } from "./FieldWrapper";
import { textInputClasses } from "./inputStyles";

interface TextFieldProps {
  id: string;
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  registration: UseFormRegisterReturn;
  autoComplete?: string;
}

export function TextField({
  id,
  label,
  hint,
  example,
  error,
  required,
  placeholder,
  registration,
  autoComplete,
}: TextFieldProps) {
  return (
    <FieldWrapper id={id} label={label} hint={hint} example={example} error={error} required={required}>
      <TextFieldInput id={id} placeholder={placeholder} registration={registration} autoComplete={autoComplete} error={error} />
    </FieldWrapper>
  );
}

function TextFieldInput({
  id,
  placeholder,
  registration,
  autoComplete,
  error,
}: {
  id: string;
  placeholder?: string;
  registration: UseFormRegisterReturn;
  autoComplete?: string;
  error?: string;
}) {
  const describedBy = useFieldDescribedBy();
  return (
    <input
      id={id}
      type="text"
      className={textInputClasses}
      placeholder={placeholder}
      autoComplete={autoComplete}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
      {...registration}
    />
  );
}
