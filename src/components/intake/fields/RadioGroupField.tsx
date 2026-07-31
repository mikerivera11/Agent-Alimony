import type { UseFormRegisterReturn } from "react-hook-form";

import { errorClasses, hintClasses } from "./inputStyles";

export interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupFieldProps {
  id: string;
  legend: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  options: RadioOption[];
  registration: UseFormRegisterReturn;
  /** Lay options out side by side instead of stacked (good for short yes/no groups). */
  inline?: boolean;
}

/**
 * A group of mutually-exclusive radio buttons. Uses `fieldset`/`legend`
 * (rather than a single `label`) because that's the correct accessible
 * pattern for a set of related radio inputs.
 */
export function RadioGroupField({
  id,
  legend,
  hint,
  example,
  error,
  required,
  options,
  registration,
  inline,
}: RadioGroupFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const exampleId = example ? `${id}-example` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, exampleId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={describedBy} aria-invalid={Boolean(error)}>
      <legend className="text-base font-semibold text-slate-900">
        {legend}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-red-700">
            *
          </span>
        ) : (
          <span className="ml-1 font-normal text-slate-600">(optional)</span>
        )}
      </legend>
      {hint ? (
        <p id={hintId} className={hintClasses}>
          {hint}
        </p>
      ) : null}
      {example ? (
        <p id={exampleId} className={`${hintClasses} italic`}>
          Example: {example}
        </p>
      ) : null}
      <div className={inline ? "flex flex-wrap gap-4" : "flex flex-col gap-2"}>
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 has-[:checked]:border-blue-700 has-[:checked]:bg-blue-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-700"
            >
              <input
                id={optionId}
                type="radio"
                value={option.value}
                className="h-5 w-5 accent-blue-800"
                {...registration}
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className={errorClasses}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
