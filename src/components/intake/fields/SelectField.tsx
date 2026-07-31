"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldWrapper, useFieldDescribedBy } from "./FieldWrapper";
import { selectClasses } from "./inputStyles";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  options: SelectOption[];
  registration: UseFormRegisterReturn;
}

export function SelectField({ id, label, hint, example, error, required, options, registration }: SelectFieldProps) {
  return (
    <FieldWrapper id={id} label={label} hint={hint} example={example} error={error} required={required}>
      <SelectInput id={id} options={options} registration={registration} error={error} />
    </FieldWrapper>
  );
}

function SelectInput({
  id,
  options,
  registration,
  error,
}: {
  id: string;
  options: SelectOption[];
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const describedBy = useFieldDescribedBy();
  return (
    <select
      id={id}
      className={selectClasses}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
      {...registration}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
