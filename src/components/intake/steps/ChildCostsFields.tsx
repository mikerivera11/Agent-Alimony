import type { ChildCosts } from "@/domain/intake";

import { MoneyField, RadioGroupField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function ChildCostsFields({ register, errors }: StepFieldsProps<ChildCosts>) {
  return (
    <div className="flex flex-col gap-5">
      <MoneyField
        id="childCareCostMonthly"
        label="Total child care (day care, before/after school care)"
        cadenceLabel="per month"
        registration={register("childCareCostMonthly")}
        error={errors.childCareCostMonthly?.message}
      />
      <MoneyField
        id="childCarePaidBySelfMonthly"
        label="Of that total, how much do you pay directly?"
        cadenceLabel="per month"
        registration={register("childCarePaidBySelfMonthly")}
        error={errors.childCarePaidBySelfMonthly?.message}
      />
      <MoneyField
        id="childCarePaidByOtherParentMonthly"
        label="Of that total, how much does the other parent pay directly?"
        cadenceLabel="per month"
        registration={register("childCarePaidByOtherParentMonthly")}
        error={errors.childCarePaidByOtherParentMonthly?.message}
      />
      <MoneyField
        id="childrenHealthInsuranceCostMonthly"
        label="Health insurance cost for the children"
        cadenceLabel="per month"
        registration={register("childrenHealthInsuranceCostMonthly")}
        error={errors.childrenHealthInsuranceCostMonthly?.message}
      />
      <MoneyField
        id="childHealthInsurancePaidBySelfMonthly"
        label="Of that insurance cost, how much do you pay directly?"
        cadenceLabel="per month"
        registration={register("childHealthInsurancePaidBySelfMonthly")}
        error={errors.childHealthInsurancePaidBySelfMonthly?.message}
      />
      <MoneyField
        id="childHealthInsurancePaidByOtherParentMonthly"
        label="Of that insurance cost, how much does the other parent pay directly?"
        cadenceLabel="per month"
        registration={register("childHealthInsurancePaidByOtherParentMonthly")}
        error={errors.childHealthInsurancePaidByOtherParentMonthly?.message}
      />
      <MoneyField
        id="extraordinaryMedicalCostsMonthly"
        label="Extraordinary medical costs"
        hint="Costs well beyond routine checkups, e.g. ongoing therapy or specialist care."
        cadenceLabel="per month"
        registration={register("extraordinaryMedicalCostsMonthly")}
        error={errors.extraordinaryMedicalCostsMonthly?.message}
      />
      <MoneyField
        id="extraordinaryEducationalCostsMonthly"
        label="Extraordinary educational costs"
        hint="For example, private school tuition or specialized tutoring."
        cadenceLabel="per month"
        registration={register("extraordinaryEducationalCostsMonthly")}
        error={errors.extraordinaryEducationalCostsMonthly?.message}
      />
      <RadioGroupField
        id="whoUsuallyPaysChildCare"
        legend="Who usually pays for child care right now?"
        required
        registration={register("whoUsuallyPaysChildCare")}
        error={errors.whoUsuallyPaysChildCare?.message}
        options={[
          { value: "me", label: "Me" },
          { value: "other_parent", label: "The other parent" },
          { value: "split", label: "We split it" },
          { value: "not_applicable", label: "Not applicable" },
        ]}
      />
    </div>
  );
}
