import type { Spouses } from "@/domain/intake";

import { RadioGroupField, TextField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function SpousesFields({ register, errors }: StepFieldsProps<Spouses>) {
  return (
    <div className="flex flex-col gap-5">
      <RadioGroupField
        id="yourRole"
        legend="In this case, are you the one who filed (petitioner) or the one who was served (respondent)?"
        hint="If nothing has been filed yet, or you're not sure, that's okay — pick 'not sure yet'."
        required
        registration={register("yourRole")}
        error={errors.yourRole?.message}
        options={[
          { value: "petitioner", label: "I am the petitioner (I filed / will file)" },
          { value: "respondent", label: "I am the respondent (I was served)" },
          { value: "not_sure", label: "Not sure yet" },
        ]}
      />
      <TextField
        id="yourNameOrInitials"
        label="Your name or initials"
        hint="Initials are enough for this preview — use whatever feels comfortable."
        example="J.R."
        required
        registration={register("yourNameOrInitials")}
        error={errors.yourNameOrInitials?.message}
      />
      <TextField
        id="spouseNameOrInitials"
        label="Your spouse's name or initials"
        example="A.R."
        required
        registration={register("spouseNameOrInitials")}
        error={errors.spouseNameOrInitials?.message}
      />
    </div>
  );
}
