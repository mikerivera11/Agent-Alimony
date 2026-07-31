import type { AssetsDebts } from "@/domain/intake";

import { MoneyField, TextareaField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function AssetsDebtsFields({ register, errors }: StepFieldsProps<AssetsDebts>) {
  return (
    <div className="flex flex-col gap-5">
      <TextareaField
        id="maritalAssetsSummary"
        label="Briefly describe what you and your spouse own together"
        example="A house, retirement accounts, a joint savings account"
        registration={register("maritalAssetsSummary")}
        error={errors.maritalAssetsSummary?.message}
      />
      <MoneyField
        id="maritalAssetsEstimatedValue"
        label="Rough total value of those assets"
        registration={register("maritalAssetsEstimatedValue")}
        error={errors.maritalAssetsEstimatedValue?.message}
      />
      <TextareaField
        id="maritalDebtsSummary"
        label="Briefly describe what you and your spouse owe together"
        example="A car loan, credit card balances, a home equity loan"
        registration={register("maritalDebtsSummary")}
        error={errors.maritalDebtsSummary?.message}
      />
      <MoneyField
        id="maritalDebtsEstimatedValue"
        label="Rough total of those debts"
        registration={register("maritalDebtsEstimatedValue")}
        error={errors.maritalDebtsEstimatedValue?.message}
      />
      <YesNoField
        id="hasOtherSupportObligations"
        legend="Does either spouse already pay support from a different case?"
        required
        registration={register("hasOtherSupportObligations")}
        error={errors.hasOtherSupportObligations?.message}
      />
      <TextareaField
        id="otherSupportObligationsDetails"
        label="Briefly describe that other support obligation"
        hint="Only needed if you answered yes above."
        registration={register("otherSupportObligationsDetails")}
        error={errors.otherSupportObligationsDetails?.message}
      />
      <YesNoField
        id="hasHiddenOrUnknownAssets"
        legend="Do you suspect your spouse has assets you don't know about, or that aren't being disclosed?"
        hint="This is common and nothing to be embarrassed about — it just means a real attorney's tools may help."
        required
        registration={register("hasHiddenOrUnknownAssets")}
        error={errors.hasHiddenOrUnknownAssets?.message}
      />
      <YesNoField
        id="hasComplexBusinessInterests"
        legend="Does either spouse own a business, or have income that's hard to pin down (e.g. commission-heavy or self-employed)?"
        required
        registration={register("hasComplexBusinessInterests")}
        error={errors.hasComplexBusinessInterests?.message}
      />
    </div>
  );
}
