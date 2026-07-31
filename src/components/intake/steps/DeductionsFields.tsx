import type { UseFormRegister, FieldErrors } from "react-hook-form";

import type { Deductions, PersonDeductions } from "@/domain/intake";

import { MoneyField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

const DEDUCTION_FIELDS: { name: keyof PersonDeductions; label: string; hint?: string }[] = [
  { name: "federalAndStateTaxWithholding", label: "Federal and state income tax withheld" },
  { name: "socialSecurityAndMedicareTax", label: "Social Security and Medicare (FICA) tax" },
  { name: "mandatoryRetirementContributions", label: "Mandatory retirement contributions" },
  { name: "healthInsurancePremiumsForSelf", label: "Health insurance premiums (for yourself)" },
  { name: "unionDues", label: "Union dues" },
  {
    name: "courtOrderedChildSupportPaidForOtherChildren",
    label: "Court-ordered child support actually paid for other children",
    hint: "Enter only child support for children outside this case that is actually paid.",
  },
  {
    name: "spousalSupportPaidUnderPriorOrder",
    label: "Spousal support paid under a prior court order",
    hint: "Do not include possible alimony in this current case.",
  },
];

function PersonDeductionsFieldset({
  prefix,
  legend,
  register,
  errors,
}: {
  prefix: "self" | "spouse";
  legend: string;
  register: UseFormRegister<Deductions>;
  errors: FieldErrors<Deductions>;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-base font-semibold text-ink">{legend}</legend>
      {DEDUCTION_FIELDS.map(({ name, label, hint }) => (
        <MoneyField
          key={name}
          id={`${prefix}.${name}`}
          label={label}
          hint={hint}
          cadenceLabel="per month"
          registration={register(`${prefix}.${name}` as `self.${typeof name}`)}
          error={errors[prefix]?.[name]?.message}
        />
      ))}
    </fieldset>
  );
}

export function DeductionsFields({ register, errors }: StepFieldsProps<Deductions>) {
  return (
    <div className="flex flex-col gap-5">
      <PersonDeductionsFieldset prefix="self" legend="Your deductions" register={register} errors={errors} />
      <PersonDeductionsFieldset prefix="spouse" legend="Your spouse's deductions" register={register} errors={errors} />
    </div>
  );
}
