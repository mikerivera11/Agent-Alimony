"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { INTAKE_STEPS, type IntakeStepId } from "@/domain/intake";

import { STEP_FIELD_COMPONENTS } from "./stepFieldRegistry";

export interface IntakeSectionHandle {
  readonly stepId: IntakeStepId;
  /**
   * Runs this section's schema and resolves with the parsed values when valid,
   * or null when not. Parsed rather than raw values, because several schemas
   * apply `.default()` and the guided wizard calculates on the parsed output.
   */
  validate: () => Promise<Record<string, unknown> | null>;
  /** Current raw values, valid or not, so partial progress can still be saved. */
  getValues: () => Record<string, unknown>;
  /** Whether this section currently shows validation errors. */
  hasErrors: () => boolean;
  /** Moves keyboard focus to this section's heading. */
  focus: () => void;
}

interface IntakeSectionProps {
  stepId: IntakeStepId;
  defaultValues: Record<string, unknown>;
  /** 1-based position, shown so a long page still feels ordered. */
  position: number;
  total: number;
  /** Fires on every keystroke so the page can autosave and re-evaluate which sections apply. */
  onValuesChange: (stepId: IntakeStepId, values: Record<string, unknown>) => void;
  ref?: Ref<IntakeSectionHandle>;
}

/**
 * One intake topic on the all-at-once page.
 *
 * Each section keeps its own `useForm` rather than the page sharing a single
 * giant form. That reuses the same schema and the same field components as the
 * guided wizard with no changes, and it keeps field names scoped: several
 * topics use plain names like `items` or `notes`, which would collide in one
 * shared form and silently overwrite each other.
 */
export function IntakeSection({
  stepId,
  defaultValues,
  position,
  total,
  onValuesChange,
  ref,
}: IntakeSectionProps) {
  const config = INTAKE_STEPS[stepId];
  const Fields = STEP_FIELD_COMPONENTS[stepId];
  const headingRef = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors },
    control,
    setValue,
  } = useForm<Record<string, unknown>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema shape varies per topic
    resolver: zodResolver(config.schema as any),
    defaultValues,
    mode: "onBlur",
  });

  useEffect(() => {
    const subscription = watch((values) => {
      onValuesChange(stepId, values as Record<string, unknown>);
    });
    return () => subscription.unsubscribe();
  }, [watch, onValuesChange, stepId]);

  useImperativeHandle(
    ref,
    () => ({
      stepId,
      validate: () =>
        new Promise<Record<string, unknown> | null>((resolve) => {
          void handleSubmit(
            (values) => resolve(values),
            () => resolve(null),
          )();
        }),
      getValues: () => getValues(),
      hasErrors: () => Object.keys(errors).length > 0,
      focus: () => headingRef.current?.focus(),
    }),
    [stepId, handleSubmit, getValues, errors],
  );

  const sectionErrorCount = Object.keys(errors).length;

  return (
    <section
      id={`section-${stepId}`}
      aria-labelledby={`section-heading-${stepId}`}
      className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-2 border-b border-border pb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Section {position} of {total}
        </p>
        <h2
          id={`section-heading-${stepId}`}
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold tracking-tight text-ink outline-none sm:text-2xl"
        >
          {config.title}
        </h2>
        <p className="text-ink-muted">{config.summary}</p>
        <p className="rounded-xl border border-info-border bg-info-surface px-4 py-3 text-sm text-info-text">
          <span className="font-semibold">Why we ask: </span>
          {config.whyWeAsk}
        </p>
        {sectionErrorCount > 0 ? (
          <p role="status" className="text-sm font-semibold text-danger-text">
            {sectionErrorCount === 1
              ? "1 answer in this section needs attention."
              : `${sectionErrorCount} answers in this section need attention.`}
          </p>
        ) : null}
      </div>

      {/*
        A plain <div>, not a <form>. Nested forms are invalid HTML, and the page
        submits every section together through the imperative handle above.
      */}
      <div className="flex flex-col gap-6 pt-5">
        <Fields register={register} errors={errors} control={control} setValue={setValue} />
      </div>
    </section>
  );
}
