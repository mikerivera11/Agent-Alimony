"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldWrapper, useFieldDescribedBy } from "./FieldWrapper";
import { textareaClasses } from "./inputStyles";

interface TextareaFieldProps {
  id: string;
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  registration: UseFormRegisterReturn;
}

export function TextareaField({ id, label, hint, example, error, required, placeholder, registration }: TextareaFieldProps) {
  return (
    <FieldWrapper id={id} label={label} hint={hint} example={example} error={error} required={required}>
      <TextareaInput id={id} placeholder={placeholder} registration={registration} error={error} />
    </FieldWrapper>
  );
}

function TextareaInput({
  id,
  placeholder,
  registration,
  error,
}: {
  id: string;
  placeholder?: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const describedBy = useFieldDescribedBy();
  return (
    <textarea
      id={id}
      rows={3}
      className={textareaClasses}
      placeholder={placeholder}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
      {...registration}
    />
  );
}
