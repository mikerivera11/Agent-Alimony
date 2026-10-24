"use client";

import { useWatch } from "react-hook-form";

import type { SettlementTerms } from "@/domain/intake";
import { Alert } from "@/components/ui";

import {
  CheckboxField,
  DateField,
  MoneyField,
  RadioGroupField,
  TextareaField,
  TextField,
} from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function SettlementTermsFields({ register, errors, control }: StepFieldsProps<SettlementTerms>) {
  const beneficiaryMode = useWatch({ control, name: "beneficiaryDesignationMode" });
  const medicalSplit = useWatch({ control, name: "uninsuredMedicalSplit" });
  const dentalSplit = useWatch({ control, name: "uninsuredDentalSplit" });
  const lifeInsuranceProvider = useWatch({ control, name: "childSupportLifeInsuranceProvider" });
  const retroactive = useWatch({ control, name: "retroactiveChildSupport" }) ?? 0;
  const arrearage = useWatch({ control, name: "childSupportArrearage" }) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="warning" role="note" className="text-sm">
        Form 12.902(f)(1) is a binding agreement when properly signed, notarized, and accepted by the
        court. The generated form is an attorney-review draft; the app does not sign or notarize it.
      </Alert>
      <CheckboxField
        id="fullDisclosureAcknowledged"
        label="Both parties report that they made full and fair disclosure of all assets and debts"
        registration={register("fullDisclosureAcknowledged")}
        error={errors.fullDisclosureAcknowledged?.message}
      />
      <TextareaField
        id="contingentAssetsLiabilities"
        label="Contingent assets or liabilities and how they will be divided"
        hint="Enter “None known” if none exist."
        required
        registration={register("contingentAssetsLiabilities")}
        error={errors.contingentAssetsLiabilities?.message}
      />
      <RadioGroupField
        id="beneficiaryDesignationMode"
        legend="Will any beneficiary designation continue after final judgment?"
        required
        registration={register("beneficiaryDesignationMode")}
        error={errors.beneficiaryDesignationMode?.message}
        options={[
          { value: "none", label: "No continuing beneficiary designation" },
          { value: "maintain_for_spouse_or_children", label: "Yes — maintain assets for a spouse or children" },
          { value: "other", label: "Other continuing designation" },
        ]}
      />
      {beneficiaryMode !== "none" ? (
        <TextareaField
          id="beneficiaryDesignationDetails"
          label="Describe the asset, owner, beneficiary, amount, and restriction"
          required
          registration={register("beneficiaryDesignationDetails")}
          error={errors.beneficiaryDesignationDetails?.message}
        />
      ) : null}
      <TextField
        id="parentingPlanExhibitLabel"
        label="Exhibit label for the attached parenting plan"
        hint="Usually A."
        required
        registration={register("parentingPlanExhibitLabel")}
        error={errors.parentingPlanExhibitLabel?.message}
      />

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">Agreed child-support payment</legend>
        <RadioGroupField
          id="childSupportObligor"
          legend="Who pays child support?"
          required
          registration={register("childSupportObligor")}
          error={errors.childSupportObligor?.message}
          options={[
            { value: "you", label: "You" },
            { value: "other_parent", label: "The other parent" },
          ]}
        />
        <MoneyField
          id="agreedChildSupportMonthly"
          label="Agreed monthly child-support amount"
          required
          registration={register("agreedChildSupportMonthly")}
          error={errors.agreedChildSupportMonthly?.message}
        />
        <DateField
          id="childSupportStartDate"
          label="Child-support start date"
          required
          registration={register("childSupportStartDate")}
          error={errors.childSupportStartDate?.message}
        />
        <DateField
          id="childSupportEndDate"
          label="Current scheduled ending date"
          required
          registration={register("childSupportEndDate")}
          error={errors.childSupportEndDate?.message}
        />
        <MoneyField
          id="childSupportPaymentAmount"
          label="Amount of each payroll-cycle payment"
          required
          registration={register("childSupportPaymentAmount")}
          error={errors.childSupportPaymentAmount?.message}
        />
        <RadioGroupField
          id="childSupportPaymentFrequency"
          legend="Payment frequency"
          required
          registration={register("childSupportPaymentFrequency")}
          error={errors.childSupportPaymentFrequency?.message}
          options={[
            { value: "weekly", label: "Weekly" },
            { value: "every_two_weeks", label: "Every two weeks" },
            { value: "twice_monthly", label: "Twice monthly" },
            { value: "monthly", label: "Monthly" },
            { value: "other", label: "Other" },
          ]}
        />
        <TextareaField
          id="childSupportStepDownSchedule"
          label="Step-down schedule as each child's obligation ends"
          required
          registration={register("childSupportStepDownSchedule")}
          error={errors.childSupportStepDownSchedule?.message}
        />
        <TextareaField
          id="childSupportDeviationReason"
          label="Reason for any deviation of 5% or more from the guideline amount"
          hint="Enter that no deviation is requested when applicable."
          required
          registration={register("childSupportDeviationReason")}
          error={errors.childSupportDeviationReason?.message}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">Retroactive support and arrears</legend>
        <MoneyField
          id="retroactiveChildSupport"
          label="Retroactive child support"
          registration={register("retroactiveChildSupport")}
          error={errors.retroactiveChildSupport?.message}
        />
        <MoneyField
          id="childSupportArrearage"
          label="Previously ordered unpaid child support"
          registration={register("childSupportArrearage")}
          error={errors.childSupportArrearage?.message}
        />
        {retroactive + arrearage > 0 ? (
          <>
            <MoneyField
              id="arrearsPaymentAmount"
              label="Payment amount toward retroactive support and arrears"
              required
              registration={register("arrearsPaymentAmount")}
              error={errors.arrearsPaymentAmount?.message}
            />
            <RadioGroupField
              id="arrearsPaymentFrequency"
              legend="Arrears payment frequency"
              required
              registration={register("arrearsPaymentFrequency")}
              error={errors.arrearsPaymentFrequency?.message}
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "every_two_weeks", label: "Every two weeks" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            <DateField
              id="arrearsPaymentStartDate"
              label="Arrears payment start date"
              required
              registration={register("arrearsPaymentStartDate")}
              error={errors.arrearsPaymentStartDate?.message}
            />
          </>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">Insurance and uncovered expenses</legend>
        <RadioGroupField
          id="healthInsuranceProvider"
          legend="Who maintains health insurance for the children?"
          required
          registration={register("healthInsuranceProvider")}
          error={errors.healthInsuranceProvider?.message}
          options={[
            { value: "you", label: "You" },
            { value: "other_parent", label: "The other parent" },
            { value: "not_available", label: "Coverage is not reasonably available or accessible" },
          ]}
        />
        <RadioGroupField
          id="uninsuredMedicalSplit"
          legend="How are uninsured medical costs divided?"
          required
          registration={register("uninsuredMedicalSplit")}
          error={errors.uninsuredMedicalSplit?.message}
          options={[
            { value: "equal", label: "Equally" },
            { value: "guideline_percentages", label: "By child-support guideline percentages" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        {medicalSplit === "other" ? (
          <TextareaField
            id="uninsuredMedicalDetails"
            label="Uninsured medical-cost arrangement"
            required
            registration={register("uninsuredMedicalDetails")}
            error={errors.uninsuredMedicalDetails?.message}
          />
        ) : null}
        <RadioGroupField
          id="dentalInsuranceProvider"
          legend="Who maintains dental insurance for the children?"
          required
          registration={register("dentalInsuranceProvider")}
          error={errors.dentalInsuranceProvider?.message}
          options={[
            { value: "you", label: "You" },
            { value: "other_parent", label: "The other parent" },
            { value: "not_available", label: "Coverage is not reasonably available or accessible" },
          ]}
        />
        <RadioGroupField
          id="uninsuredDentalSplit"
          legend="How are uninsured dental costs divided?"
          required
          registration={register("uninsuredDentalSplit")}
          error={errors.uninsuredDentalSplit?.message}
          options={[
            { value: "equal", label: "Equally" },
            { value: "guideline_percentages", label: "By child-support guideline percentages" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        {dentalSplit === "other" ? (
          <TextareaField
            id="uninsuredDentalDetails"
            label="Uninsured dental-cost arrangement"
            required
            registration={register("uninsuredDentalDetails")}
            error={errors.uninsuredDentalDetails?.message}
          />
        ) : null}
        <RadioGroupField
          id="childSupportLifeInsuranceProvider"
          legend="Will either parent maintain life insurance to secure child support?"
          required
          registration={register("childSupportLifeInsuranceProvider")}
          error={errors.childSupportLifeInsuranceProvider?.message}
          options={[
            { value: "none", label: "No" },
            { value: "you", label: "You will maintain it" },
            { value: "other_parent", label: "The other parent will maintain it" },
          ]}
        />
        {lifeInsuranceProvider !== "none" ? (
          <MoneyField
            id="childSupportLifeInsuranceAmount"
            label="Life-insurance amount"
            required
            registration={register("childSupportLifeInsuranceAmount")}
            error={errors.childSupportLifeInsuranceAmount?.message}
          />
        ) : null}
      </fieldset>

      <TextareaField
        id="taxExemptionTerms"
        label="Child tax-exemption terms"
        required
        registration={register("taxExemptionTerms")}
        error={errors.taxExemptionTerms?.message}
      />
      <TextareaField
        id="otherChildSupportTerms"
        label="Other child-support terms"
        required
        registration={register("otherChildSupportTerms")}
        error={errors.otherChildSupportTerms?.message}
      />
      <TextareaField
        id="otherSettlementTerms"
        label="Other settlement terms"
        required
        registration={register("otherSettlementTerms")}
        error={errors.otherSettlementTerms?.message}
      />
      <TextareaField
        id="unresolvedIssues"
        label="Issues the parties have not agreed on"
        hint="Enter “None” only if every issue is resolved."
        required
        registration={register("unresolvedIssues")}
        error={errors.unresolvedIssues?.message}
      />
    </div>
  );
}
