import type { UseFormRegisterReturn } from "react-hook-form";

import { RadioGroupField } from "./RadioGroupField";

interface YesNoFieldProps {
  id: string;
  legend: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  registration: UseFormRegisterReturn;
  yesLabel?: string;
  noLabel?: string;
}

/** A simple yes/no question, built on top of RadioGroupField. */
export function YesNoField({
  id,
  legend,
  hint,
  example,
  error,
  required,
  registration,
  yesLabel = "Yes",
  noLabel = "No",
}: YesNoFieldProps) {
  return (
    <RadioGroupField
      id={id}
      legend={legend}
      hint={hint}
      example={example}
      error={error}
      required={required}
      registration={registration}
      inline
      options={[
        { value: "yes", label: yesLabel },
        { value: "no", label: noLabel },
      ]}
    />
  );
}
