import { useWatch } from "react-hook-form";

import type { AlimonyFactors } from "@/domain/intake";

import { DateField, MoneyField, RadioGroupField, TextareaField, TextField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function AlimonyFactorsFields({ register, errors, control }: StepFieldsProps<AlimonyFactors>) {
  const agreementStatus = useWatch({ control, name: "alimonyAgreementStatus" });

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
      <fieldset className="flex flex-col gap-5 rounded-xl border border-line p-5">
        <legend className="px-2 text-base font-semibold text-ink">Agreed alimony terms for the attorney packet</legend>
        <p className="text-sm text-ink-muted">
          The filing packet uses only the agreement entered here. The calculated estimate remains on the results
          screen for comparison and is not inserted into the attorney packet or court-form draft.
        </p>
        <RadioGroupField
          id="alimonyAgreementStatus"
          legend="Have you and your spouse reached an agreement about alimony?"
          required
          registration={register("alimonyAgreementStatus")}
          error={errors.alimonyAgreementStatus?.message}
          options={[
            { value: "agreed_payment", label: "Yes — alimony will be paid" },
            { value: "agreed_waiver", label: "Yes — the agreement is that no alimony will be paid" },
            { value: "not_agreed", label: "No — terms are not agreed yet" },
          ]}
        />
        {agreementStatus === "agreed_payment" ? (
          <>
            <RadioGroupField
              id="agreedAlimonyType"
              legend="Agreed type of alimony"
              required
              registration={register("agreedAlimonyType")}
              error={errors.agreedAlimonyType?.message}
              options={[
                { value: "bridge_the_gap", label: "Bridge-the-gap" },
                { value: "rehabilitative", label: "Rehabilitative" },
                { value: "durational", label: "Durational" },
                { value: "lump_sum", label: "Lump sum" },
                { value: "other", label: "Other — explain in notes" },
              ]}
            />
            <MoneyField
              id="agreedAlimonyAmount"
              label="Agreed payment amount"
              hint="Enter the amount of each payment, or the full amount for a one-time lump sum."
              required
              registration={register("agreedAlimonyAmount")}
              error={errors.agreedAlimonyAmount?.message}
            />
            <RadioGroupField
              id="agreedAlimonyFrequency"
              legend="How often will that amount be paid?"
              required
              registration={register("agreedAlimonyFrequency")}
              error={errors.agreedAlimonyFrequency?.message}
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "every_two_weeks", label: "Every two weeks" },
                { value: "twice_monthly", label: "Twice monthly" },
                { value: "monthly", label: "Monthly" },
                { value: "one_time", label: "One-time payment" },
                { value: "other", label: "Other — explain in notes" },
              ]}
            />
            <DateField
              id="agreedAlimonyStartDate"
              label="Payment start date"
              required
              registration={register("agreedAlimonyStartDate")}
              error={errors.agreedAlimonyStartDate?.message}
            />
            <TextField
              id="agreedAlimonyEndCondition"
              label="Duration or ending condition"
              hint="For example: 60 monthly payments, through August 2031, or one payment due on the start date."
              required
              registration={register("agreedAlimonyEndCondition")}
              error={errors.agreedAlimonyEndCondition?.message}
            />
            <RadioGroupField
              id="agreedAlimonyModifiability"
              legend="Can the agreed alimony terms be modified later?"
              required
              registration={register("agreedAlimonyModifiability")}
              error={errors.agreedAlimonyModifiability?.message}
              options={[
                { value: "modifiable", label: "Modifiable" },
                { value: "nonmodifiable", label: "Nonmodifiable" },
                { value: "attorney_to_confirm", label: "Attorney must confirm the language" },
              ]}
            />
            <RadioGroupField
              id="agreedAlimonyPaymentMethod"
              legend="Agreed payment method"
              required
              registration={register("agreedAlimonyPaymentMethod")}
              error={errors.agreedAlimonyPaymentMethod?.message}
              options={[
                { value: "direct", label: "Direct payment between spouses" },
                { value: "state_disbursement_unit", label: "State Disbursement Unit" },
                { value: "income_withholding", label: "Income withholding" },
                { value: "other", label: "Other — explain in notes" },
                { value: "attorney_to_confirm", label: "Attorney must confirm" },
              ]}
            />
            <RadioGroupField
              id="agreedAlimonySecurity"
              legend="Is security required for the alimony obligation?"
              required
              registration={register("agreedAlimonySecurity")}
              error={errors.agreedAlimonySecurity?.message}
              options={[
                { value: "none", label: "No security" },
                { value: "life_insurance", label: "Life insurance" },
                { value: "other", label: "Other security — explain in notes" },
                { value: "attorney_to_confirm", label: "Attorney must confirm" },
              ]}
            />
            <TextareaField
              id="agreedAlimonyNotes"
              label="Other agreed alimony terms or drafting notes"
              hint="Include any payment-day details, security amount, special termination event, or other term the attorney should address."
              registration={register("agreedAlimonyNotes")}
              error={errors.agreedAlimonyNotes?.message}
            />
          </>
        ) : null}
        {agreementStatus === "agreed_waiver" ? (
          <p className="rounded-lg bg-surface-muted p-4 text-sm text-ink-muted">
            The packet will state that the parties report an agreement for no alimony. An attorney must draft the
            exact waiver and confirm whether it is permanent and nonmodifiable.
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
