"use client";

import { useWatch } from "react-hook-form";

import type { SafetyComplexity } from "@/domain/intake";

import { TextareaField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function SafetyComplexityFields({ register, errors, control }: StepFieldsProps<SafetyComplexity>) {
  const domesticViolenceOrCoercion = useWatch({ control, name: "domesticViolenceOrCoercion" });

  return (
    <div className="flex flex-col gap-5">
      <YesNoField
        id="domesticViolenceOrCoercion"
        legend="Is domestic violence, coercion, or intimidation a concern in your situation?"
        hint="Answering yes never sends information anywhere — it only changes what this screen shows you next."
        required
        registration={register("domesticViolenceOrCoercion")}
        error={errors.domesticViolenceOrCoercion?.message}
      />
      {domesticViolenceOrCoercion === "yes" ? (
        <div role="alert" className="rounded-xl border-2 border-danger-border bg-danger-surface p-4 text-danger-text">
          <p className="font-semibold">Your safety matters more than this form.</p>
          <p className="mt-1 text-sm">
            If you are in immediate danger, call 911. You can also reach the National Domestic Violence
            Hotline any time at{" "}
            <a href="tel:18007997233" className="font-semibold underline">
              1-800-799-7233
            </a>
            . Use the &quot;Quick exit&quot; link at the top of this page to leave this site immediately.
          </p>
        </div>
      ) : null}
      {domesticViolenceOrCoercion === "yes" ? (
        <YesNoField
          id="feelsSafeToContinueOnline"
          legend="Is it safe for you to keep using this tool on this device right now?"
          required
          registration={register("feelsSafeToContinueOnline")}
          error={errors.feelsSafeToContinueOnline?.message}
        />
      ) : null}
      <YesNoField
        id="hasJurisdictionDispute"
        legend="Is there any disagreement about which state (or country) should handle this case?"
        hint="For example, you and your spouse live in different states, or one of you recently moved."
        required
        registration={register("hasJurisdictionDispute")}
        error={errors.hasJurisdictionDispute?.message}
      />
      <YesNoField
        id="incomeIsImputedOrDisputed"
        legend="Is there a disagreement about how much someone actually earns, or could a court treat someone as earning more than they report?"
        required
        registration={register("incomeIsImputedOrDisputed")}
        error={errors.incomeIsImputedOrDisputed?.message}
      />
      <YesNoField
        id="filedOrFilingBeforeJuly2023"
        legend="Was your case filed, or will it be filed based on a petition served, before July 1, 2023?"
        hint="Florida's alimony law changed substantially on July 1, 2023. Earlier cases can follow different rules."
        required
        registration={register("filedOrFilingBeforeJuly2023")}
        error={errors.filedOrFilingBeforeJuly2023?.message}
      />
      <TextareaField
        id="otherComplexityNotes"
        label="Anything else that feels complicated about your situation?"
        registration={register("otherComplexityNotes")}
        error={errors.otherComplexityNotes?.message}
      />
    </div>
  );
}
