"use client";

import { useFieldArray, useWatch } from "react-hook-form";

import type { Children } from "@/domain/intake";

import { secondaryButtonClasses } from "../fields/inputStyles";
import { TextField, DateField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

function generateChildId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ChildrenFields({ register, errors, control }: StepFieldsProps<Children>) {
  const hasChildren = useWatch({ control, name: "hasChildren" });
  const { fields, append, remove } = useFieldArray({ control, name: "children" });

  return (
    <div className="flex flex-col gap-5">
      <YesNoField
        id="hasChildren"
        legend="Do you and your spouse have shared minor children?"
        required
        registration={register("hasChildren")}
        error={errors.hasChildren?.message}
      />
      {hasChildren === "yes" ? (
        <div className="flex flex-col gap-4">
          {fields.map((field, index) => (
            <fieldset key={field.id} className="flex flex-col gap-4 rounded-xl border border-border p-4">
              <legend className="px-1 text-base font-semibold text-ink">Child {index + 1}</legend>
              <TextField
                id={`children.${index}.nameOrInitials`}
                label="Name or initials"
                required
                registration={register(`children.${index}.nameOrInitials` as const)}
                error={errors.children?.[index]?.nameOrInitials?.message}
              />
              <DateField
                id={`children.${index}.dateOfBirth`}
                label="Date of birth"
                required
                registration={register(`children.${index}.dateOfBirth` as const)}
                error={errors.children?.[index]?.dateOfBirth?.message}
              />
              <YesNoField
                id={`children.${index}.hasSpecialNeeds`}
                legend="Does this child have a disability or special need the court should know about?"
                required
                registration={register(`children.${index}.hasSpecialNeeds` as const)}
                error={errors.children?.[index]?.hasSpecialNeeds?.message}
              />
              <TextField
                id={`children.${index}.specialNeedsDetails`}
                label="Briefly describe the special need"
                hint="Only needed if you answered yes above."
                registration={register(`children.${index}.specialNeedsDetails` as const)}
                error={errors.children?.[index]?.specialNeedsDetails?.message}
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className={`${secondaryButtonClasses} self-start`}
              >
                Remove child {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            onClick={() =>
              append({
                id: generateChildId(),
                nameOrInitials: "",
                dateOfBirth: "",
                hasSpecialNeeds: "no",
                specialNeedsDetails: "",
              })
            }
            className={`${secondaryButtonClasses} self-start`}
          >
            + Add a child
          </button>
          {errors.children?.message ? (
            <p role="alert" className="text-sm font-medium text-danger-solid">
              {errors.children.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
