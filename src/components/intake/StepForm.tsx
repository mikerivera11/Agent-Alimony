"use client";

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
  onBack?: () => void;
  showBack: boolean;
  isLastStep: boolean;
}

/** Renders one wizard topic as a self-contained form with its own validation. */
export function StepForm({ stepId, defaultValues, onSubmit, onBack, showBack, isLastStep }: StepFormProps) {
  const config = INTAKE_STEPS[stepId];
  const Fields = STEP_FIELD_COMPONENTS[stepId];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
  } = useForm<Record<string, unknown>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema shape varies per topic
    resolver: zodResolver(config.schema as any),
    defaultValues,
    mode: "onSubmit",
  });

  return (
    <StepLayout key={stepId} title={config.title} summary={config.summary} whyWeAsk={config.whyWeAsk}>
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
