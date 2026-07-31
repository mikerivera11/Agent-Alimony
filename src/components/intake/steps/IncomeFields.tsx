import type { UseFormRegister, FieldErrors } from "react-hook-form";

import type { Income, PersonIncome } from "@/domain/intake";

import { MoneyField, TextareaField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

const INCOME_FIELDS: { name: keyof PersonIncome; label: string; hint?: string }[] = [
  { name: "wages", label: "Wages or salary", hint: "Before taxes, from a pay stub or employer." },
  { name: "selfEmploymentIncome", label: "Self-employment income" },
  { name: "bonusesAndCommissions", label: "Bonuses or commissions" },
  { name: "investmentIncome", label: "Investment income", hint: "Dividends, interest, capital gains." },
  { name: "rentalIncome", label: "Rental income" },
  { name: "retirementOrPensionIncome", label: "Retirement or pension income" },
  { name: "unemploymentBenefits", label: "Unemployment benefits" },
  { name: "disabilityBenefits", label: "Disability benefits" },
  { name: "otherIncome", label: "Other income" },
];

function PersonIncomeFieldset({
  prefix,
  legend,
  register,
  errors,
}: {
  prefix: "self" | "spouse";
  legend: string;
  register: UseFormRegister<Income>;
  errors: FieldErrors<Income>;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-slate-300 p-4">
      <legend className="px-1 text-base font-semibold text-slate-900">{legend}</legend>
      {INCOME_FIELDS.map(({ name, label, hint }) => (
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

export function IncomeFields({ register, errors }: StepFieldsProps<Income>) {
  return (
    <div className="flex flex-col gap-5">
      <PersonIncomeFieldset prefix="self" legend="Your income" register={register} errors={errors} />
      <PersonIncomeFieldset prefix="spouse" legend="Your spouse's income" register={register} errors={errors} />
      <TextareaField
        id="incomeNotes"
        label="Anything else about income we should know?"
        registration={register("incomeNotes")}
        error={errors.incomeNotes?.message}
      />
    </div>
  );
}
