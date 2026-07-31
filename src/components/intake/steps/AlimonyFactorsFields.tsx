import type { AlimonyFactors } from "@/domain/intake";

import { MoneyField, RadioGroupField, TextareaField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function AlimonyFactorsFields({ register, errors }: StepFieldsProps<AlimonyFactors>) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-muted">
        Florida law (Section 61.08, Florida Statutes) asks judges to weigh several factors when deciding
        alimony. These questions cover the main ones in plain language — short answers are fine.
      </p>
      <TextareaField
        id="standardOfLivingDuringMarriage"
        label="What was your household's standard of living during the marriage?"
        example="Middle-income, two-earner household; owned a home; took one vacation a year."
        required
        registration={register("standardOfLivingDuringMarriage")}
        error={errors.standardOfLivingDuringMarriage?.message}
      />
      <RadioGroupField
        id="potentialAlimonyRecipient"
        legend="Who may receive alimony in this planning scenario?"
        hint="We will not assume the lower earner is the recipient. Choose 'not sure' if this is disputed."
        required
        registration={register("potentialAlimonyRecipient")}
        error={errors.potentialAlimonyRecipient?.message}
        options={[
          { value: "self", label: "Me" },
          { value: "spouse", label: "My spouse" },
          { value: "not_sure", label: "Not sure or disputed" },
          { value: "none", label: "No alimony requested" },
        ]}
      />
      <MoneyField
        id="confirmedReasonableMonthlyNeed"
        label="Recipient's documented reasonable monthly need"
        hint="Optional. Leave this at 0 and we'll calculate the monthly shortfall for you from the living expenses and income you already entered. Enter a figure here only if you have a documented budget you'd rather use."
        cadenceLabel="per month"
        registration={register("confirmedReasonableMonthlyNeed")}
        error={errors.confirmedReasonableMonthlyNeed?.message}
      />
      <YesNoField
        id="rehabilitativePlanConfirmed"
        legend="Is there a specific written education, training, or work plan for rehabilitative alimony?"
        required
        registration={register("rehabilitativePlanConfirmed")}
        error={errors.rehabilitativePlanConfirmed?.message}
      />
      <YesNoField
        id="exceptionalCircumstancesExtensionRequested"
        legend="Are exceptional circumstances being claimed to extend durational alimony beyond the normal cap?"
        hint="The app will flag this for attorney review and will not calculate an extension."
        required
        registration={register("exceptionalCircumstancesExtensionRequested")}
        error={errors.exceptionalCircumstancesExtensionRequested?.message}
      />
      <TextareaField
        id="ageAndHealthSelf"
        label="Your age and general health"
        required
        registration={register("ageAndHealthSelf")}
        error={errors.ageAndHealthSelf?.message}
      />
      <TextareaField
        id="ageAndHealthSpouse"
        label="Your spouse's age and general health"
        required
        registration={register("ageAndHealthSpouse")}
        error={errors.ageAndHealthSpouse?.message}
      />
      <TextareaField
        id="earningCapacitySelf"
        label="Your ability to earn income now and in the near future"
        required
        registration={register("earningCapacitySelf")}
        error={errors.earningCapacitySelf?.message}
      />
      <TextareaField
        id="earningCapacitySpouse"
        label="Your spouse's ability to earn income now and in the near future"
        required
        registration={register("earningCapacitySpouse")}
        error={errors.earningCapacitySpouse?.message}
      />
      <TextareaField
        id="contributionsToMarriage"
        label="Contributions to the marriage"
        example="Homemaking, raising children, supporting a spouse's education or career."
        required
        registration={register("contributionsToMarriage")}
        error={errors.contributionsToMarriage?.message}
      />
      <TextareaField
        id="otherFactors"
        label="Anything else you'd want a judge to know?"
        registration={register("otherFactors")}
        error={errors.otherFactors?.message}
      />
      <RadioGroupField
        id="requestedAlimonyType"
        legend="If you're requesting alimony, what type (if you know)?"
        hint="It's okay to choose 'not sure' — a lawyer or the court can help identify the right type."
        required
        registration={register("requestedAlimonyType")}
        error={errors.requestedAlimonyType?.message}
        options={[
          { value: "not_sure", label: "Not sure" },
          { value: "bridge_the_gap", label: "Bridge-the-gap" },
          { value: "rehabilitative", label: "Rehabilitative" },
          { value: "durational", label: "Durational" },
          { value: "permanent", label: "Permanent" },
          { value: "none", label: "I'm not requesting alimony" },
        ]}
      />
    </div>
  );
}
