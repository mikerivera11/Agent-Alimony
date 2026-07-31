"use client";

import { createContext, useContext, type ReactNode } from "react";

import { errorClasses, hintClasses, labelClasses } from "./inputStyles";

interface FieldContextValue {
  describedBy: string | undefined;
}

const FieldContext = createContext<FieldContextValue>({ describedBy: undefined });

/** Returns the `aria-describedby` value assembled by the enclosing FieldWrapper. */
export function useFieldDescribedBy(): string | undefined {
  return useContext(FieldContext).describedBy;
}

interface FieldWrapperProps {
  id: string;
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * Wraps a single form control with a visible label, an optional plain-language
 * hint/example ("why we ask"), and an error message — all connected to the
 * control via `aria-describedby` so screen readers announce them together.
 */
export function FieldWrapper({ id, label, hint, example, error, required, children }: FieldWrapperProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const exampleId = example ? `${id}-example` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClasses}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-danger-solid">
            *
          </span>
        ) : (
          <span className="ml-1 font-normal text-ink-subtle">(optional)</span>
        )}
      </label>
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
      <FieldContext.Provider
        value={{ describedBy: [hintId, exampleId, errorId].filter(Boolean).join(" ") || undefined }}
      >
        {children}
      </FieldContext.Provider>
      {error ? (
        <p id={errorId} role="alert" className={errorClasses}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
