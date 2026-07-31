import type { UseFormRegisterReturn } from "react-hook-form";

import { errorClasses, hintClasses } from "./inputStyles";

interface CheckboxFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  registration: UseFormRegisterReturn;
}

/** A single stand-alone checkbox (e.g. an acknowledgement), not a radio group. */
export function CheckboxField({ id, label, hint, error, registration }: CheckboxFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-slate-400 bg-white px-3 py-2.5 text-base text-slate-900 has-[:checked]:border-blue-700 has-[:checked]:bg-blue-50"
      >
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-blue-800"
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          {...registration}
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <p id={hintId} className={hintClasses}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className={errorClasses}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
