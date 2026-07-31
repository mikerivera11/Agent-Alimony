import type { CaseBasics } from "@/domain/intake";

import { DateField, RadioGroupField, TextField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function CaseBasicsFields({ register, errors }: StepFieldsProps<CaseBasics>) {
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id="county"
        label="Florida county where your case is (or will be) filed"
        example="Duval, Miami-Dade, Orange"
        required
        registration={register("county")}
        error={errors.county?.message}
      />
      <RadioGroupField
        id="caseType"
        legend="Do you and your spouse have shared minor children?"
        required
        registration={register("caseType")}
        error={errors.caseType?.message}
        options={[
          { value: "with_children", label: "Yes, we have shared minor children" },
          { value: "without_children", label: "No shared minor children" },
        ]}
      />
      <RadioGroupField
        id="petitionStatus"
        legend="Has a divorce (dissolution of marriage) petition already been filed?"
        required
        registration={register("petitionStatus")}
        error={errors.petitionStatus?.message}
        options={[
          { value: "not_filed", label: "Not filed yet" },
          { value: "filed", label: "Already filed" },
        ]}
      />
      <DateField
        id="petitionDate"
        label="Petition filing date, or planning date if you have not filed"
        hint="Florida measures marriage length through the filing date. If you have not filed, use today's date for a clearly labeled planning estimate."
        required
        registration={register("petitionDate")}
        error={errors.petitionDate?.message}
      />
      <YesNoField
        id="hasAttorney"
        legend="Do you currently have an attorney?"
        hint="This helps us decide when to remind you that this tool is not a substitute for legal advice."
        required
        registration={register("hasAttorney")}
        error={errors.hasAttorney?.message}
      />
    </div>
  );
}
