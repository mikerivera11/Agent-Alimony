import type { Marriage } from "@/domain/intake";

import { DateField, RadioGroupField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function MarriageFields({ register, errors }: StepFieldsProps<Marriage>) {
  return (
    <div className="flex flex-col gap-5">
      <DateField
        id="marriageDate"
        label="Date you were married"
        required
        registration={register("marriageDate")}
        error={errors.marriageDate?.message}
      />
      <RadioGroupField
        id="separationStatus"
        legend="What best describes your current living situation?"
        required
        registration={register("separationStatus")}
        error={errors.separationStatus?.message}
        options={[
          { value: "living_together", label: "Still living together" },
          { value: "separated_no_date", label: "Separated, but not sure of the exact date" },
          { value: "separated_with_date", label: "Separated on a specific date" },
        ]}
      />
      <DateField
        id="separationDate"
        label="Date you separated"
        hint="Only needed if you selected a specific separation date above."
        registration={register("separationDate")}
        error={errors.separationDate?.message}
      />
    </div>
  );
}
