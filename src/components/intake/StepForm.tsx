"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { INTAKE_STEPS, type IntakeStepId } from "@/domain/intake";

import { StepLayout } from "./StepLayout";
import { StepNavButtons } from "./StepNavButtons";
import { STEP_FIELD_COMPONENTS } from "./stepFieldRegistry";

interface StepFormProps {
  stepId: IntakeStepId;
  defaultValues: Record<string, unknown>;
  onSubmit: (stepId: IntakeStepId, values: Record<string, unknown>) => void;
  /**
   * Called with the current, *unvalidated* values as the person types. Lets a
   * half-finished topic survive navigating away, which plain `onSubmit` alone
   * cannot do.
   */
  onAutoSave?: (stepId: IntakeStepId, values: Record<string, unknown>) => void;
  onBack?: () => void;
  showBack: boolean;
  isLastStep: boolean;
}

/** How long typing must pause before a partial answer is written to storage. */
const AUTOSAVE_DEBOUNCE_MS = 800;

/** Renders one wizard topic as a self-contained form with its own validation. */
export function StepForm({
  stepId,
  defaultValues,
  onSubmit,
  onAutoSave,
  onBack,
  showBack,
  isLastStep,
}: StepFormProps) {
  const config = INTAKE_STEPS[stepId];
  const Fields = STEP_FIELD_COMPONENTS[stepId];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    watch,
    getValues,
  } = useForm<Record<string, unknown>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema shape varies per topic
    resolver: zodResolver(config.schema as any),
    defaultValues,
    mode: "onSubmit",
  });

  // Kept in a ref so the autosave subscription below can stay mounted for the
  // life of the topic without resubscribing every time the parent re-renders.
  const autoSaveRef = useRef(onAutoSave);
  autoSaveRef.current = onAutoSave;

  useEffect(() => {
    if (!onAutoSave) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        autoSaveRef.current?.(stepId, values as Record<string, unknown>);
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      // Flush on the way out so clicking "Back" immediately after typing still
      // keeps the answer — the debounce must never be able to swallow it.
      if (timer) {
        clearTimeout(timer);
        autoSaveRef.current?.(stepId, getValues());
      }
      subscription.unsubscribe();
    };
    // `onAutoSave` is read through the ref, so only the topic identity matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, watch, getValues]);

  return (
    <StepLayout key={stepId} stepId={stepId} title={config.title} summary={config.summary} whyWeAsk={config.whyWeAsk}>
      <form
        noValidate
        onSubmit={handleSubmit((values) => onSubmit(stepId, values))}
        className="flex flex-col gap-6"
      >
        <Fields register={register} errors={errors} control={control} setValue={setValue} />
        <StepNavButtons
          onBack={onBack}
          showBack={showBack}
          isSubmitting={isSubmitting}
          submitLabel={isLastStep ? "Save and go to review" : "Save and continue"}
        />
      </form>
    </StepLayout>
  );
}
