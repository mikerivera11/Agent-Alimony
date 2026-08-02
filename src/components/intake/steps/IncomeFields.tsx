import type { UseFormRegister, FieldErrors, UseFormSetValue } from "react-hook-form";

import type { Income, PersonIncome } from "@/domain/intake";

import { AnnualisedMoneyField, MoneyField, TextareaField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

interface IncomeFieldConfig {
  name: keyof PersonIncome;
  label: string;
  hint?: string;
  /**
   * Offers the yearly-amount helper. Set for pay that arrives in lumps, where
   * a person genuinely may not know the monthly figure.
   */
  lumpy?: boolean;
}

const INCOME_FIELDS: IncomeFieldConfig[] = [
  { name: "wages", label: "Wages or salary", hint: "Before taxes, from a pay stub or employer." },
  { name: "selfEmploymentIncome", label: "Self-employment income" },
  {
    name: "bonusesAndCommissions",
    label: "Bonuses and sales commissions",
    hint: "Florida counts bonuses, commissions, allowances, overtime, and tips as income (§61.30(2)(a)2.).",
    lumpy: true,
  },
  {
    name: "equityCompensation",
    label: "Stock or equity that vests as pay",
    hint: "RSUs or shares you receive for working, counted in the period they vest. Not shares you already own.",
    lumpy: true,
  },
  {
    name: "investmentIncome",
    label: "Interest and dividends",
    hint: "Ongoing returns on savings or investments (§61.30(2)(a)10.). Money from selling something goes below.",
  },
  {
    name: "recurringCapitalGains",
    label: "Gains from selling stock or property — if this keeps happening",
    hint: "Use this only if selling is a regular part of your finances, such as routinely selling vested shares.",
    lumpy: true,
  },
  {
    name: "nonrecurringGains",
    label: "One-time gains you do not expect to repeat",
    hint:
      "Florida does not count nonrecurring gains as income (§61.30(2)(a)14.), so this is recorded but not added to monthly income.",
    lumpy: true,
  },
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
  setValue,
}: {
  prefix: "self" | "spouse";
  legend: string;
  register: UseFormRegister<Income>;
  errors: FieldErrors<Income>;
  setValue: UseFormSetValue<Income>;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-base font-semibold text-ink">{legend}</legend>
      {INCOME_FIELDS.map(({ name, label, hint, lumpy }) => {
        const path = `${prefix}.${name}` as `self.${keyof PersonIncome}`;
        const registration = register(path);
        const error = errors[prefix]?.[name]?.message;

        return lumpy ? (
          <AnnualisedMoneyField
            key={name}
            id={path}
            label={label}
            hint={hint}
            registration={registration}
            error={error}
            onApplyMonthly={(monthly) =>
              setValue(path, monthly, { shouldDirty: true, shouldValidate: true })
            }
          />
        ) : (
          <MoneyField
            key={name}
            id={path}
            label={label}
            hint={hint}
            cadenceLabel="per month"
            registration={registration}
            error={error}
          />
        );
      })}
    </fieldset>
  );
}

export function IncomeFields({ register, errors, setValue }: StepFieldsProps<Income>) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-info-border bg-info-surface p-4 text-sm text-info-text">
        <p className="font-semibold">How variable pay is treated</p>
        <p className="mt-1">
          Florida counts bonuses, commissions, and equity you earn for working as income, just like salary
          (§61.30(2)(a)2.). Gains from selling stock or property count only if they keep happening — a one-time
          sale is left out (§61.30(2)(a)14.). The same definition drives both calculations, because the alimony
          statute says net income is figured &ldquo;in conformity with s. 61.30(2) and (3)&rdquo; (§61.08(8)(c)).
        </p>
      </div>

      <PersonIncomeFieldset
        prefix="self"
        legend="Your income"
        register={register}
        errors={errors}
        setValue={setValue}
      />
      <PersonIncomeFieldset
        prefix="spouse"
        legend="Your spouse's income"
        register={register}
        errors={errors}
        setValue={setValue}
      />
      <TextareaField
        id="incomeNotes"
        label="Anything else about income we should know?"
        hint="If your bonus or commission swings a lot year to year, say so — how it gets averaged can change the result."
        registration={register("incomeNotes")}
        error={errors.incomeNotes?.message}
      />
    </div>
  );
}
