import type { DocumentReadiness } from "@/domain/intake";

import { CheckboxField, RadioGroupField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function DocumentReadinessFields({ register, errors }: StepFieldsProps<DocumentReadiness>) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-700">
        This is just a checklist for you — nothing is uploaded or checked in this preview.
      </p>
      <YesNoField
        id="hasRecentPayStubsOrIncomeProof"
        legend="Do you have recent pay stubs or other proof of income?"
        required
        registration={register("hasRecentPayStubsOrIncomeProof")}
        error={errors.hasRecentPayStubsOrIncomeProof?.message}
      />
      <YesNoField
        id="hasTaxReturnsLastThreeYears"
        legend="Do you have tax returns from the last three years?"
        required
        registration={register("hasTaxReturnsLastThreeYears")}
        error={errors.hasTaxReturnsLastThreeYears?.message}
      />
      <YesNoField
        id="hasBankAndAssetStatements"
        legend="Do you have recent bank and asset statements?"
        required
        registration={register("hasBankAndAssetStatements")}
        error={errors.hasBankAndAssetStatements?.message}
      />
      <RadioGroupField
        id="hasParentingOrTimeshareRecords"
        legend="Do you have records of the parenting time / timesharing schedule?"
        required
        registration={register("hasParentingOrTimeshareRecords")}
        error={errors.hasParentingOrTimeshareRecords?.message}
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "not_applicable", label: "Not applicable" },
        ]}
      />
      <CheckboxField
        id="acknowledgesSevenDayRetention"
        label="I understand that, when document uploads are available, any files I add are automatically deleted after 7 days."
        hint="No documents are uploaded in this preview — this is just for your awareness going forward."
        registration={register("acknowledgesSevenDayRetention")}
        error={errors.acknowledgesSevenDayRetention?.message}
      />
    </div>
  );
}
