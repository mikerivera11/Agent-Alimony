import type { HouseholdExpenses } from "@/domain/intake";

import { MoneyField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function HouseholdExpensesFields({ register, errors }: StepFieldsProps<HouseholdExpenses>) {
  return (
    <div className="flex flex-col gap-5">
      <MoneyField
        id="housingMonthly"
        label="Housing"
        hint="Rent or mortgage, property tax, HOA fees."
        cadenceLabel="per month"
        registration={register("housingMonthly")}
        error={errors.housingMonthly?.message}
      />
      <MoneyField
        id="utilitiesMonthly"
        label="Utilities"
        hint="Electric, water, gas, internet, phone."
        cadenceLabel="per month"
        registration={register("utilitiesMonthly")}
        error={errors.utilitiesMonthly?.message}
      />
      <MoneyField
        id="foodMonthly"
        label="Food and groceries"
        cadenceLabel="per month"
        registration={register("foodMonthly")}
        error={errors.foodMonthly?.message}
      />
      <MoneyField
        id="transportationMonthly"
        label="Transportation"
        hint="Car payment, gas, insurance, transit fares."
        cadenceLabel="per month"
        registration={register("transportationMonthly")}
        error={errors.transportationMonthly?.message}
      />
      <MoneyField
        id="insuranceMonthly"
        label="Other insurance"
        hint="Life, renters/homeowners, or your own health insurance if not already counted."
        cadenceLabel="per month"
        registration={register("insuranceMonthly")}
        error={errors.insuranceMonthly?.message}
      />
      <MoneyField
        id="minimumDebtPaymentsMonthly"
        label="Minimum debt payments"
        hint="Credit cards, personal loans, student loans."
        cadenceLabel="per month"
        registration={register("minimumDebtPaymentsMonthly")}
        error={errors.minimumDebtPaymentsMonthly?.message}
      />
      <MoneyField
        id="otherMonthlyExpenses"
        label="Other regular expenses"
        cadenceLabel="per month"
        registration={register("otherMonthlyExpenses")}
        error={errors.otherMonthlyExpenses?.message}
      />
    </div>
  );
}
