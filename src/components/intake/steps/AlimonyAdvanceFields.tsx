"use client";

import { useFieldArray, useWatch } from "react-hook-form";

import type { AlimonyAdvance } from "@/domain/intake";
import { Alert } from "@/components/ui";

import { DateField, MoneyField, RadioGroupField, TextareaField, TextField, YesNoField } from "../fields";
import { dangerLinkClasses, secondaryButtonClasses } from "../fields/inputStyles";
import type { StepFieldsProps } from "./StepFieldsProps";

function generatePaymentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `advance-payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AlimonyAdvanceFields({ register, errors, control }: StepFieldsProps<AlimonyAdvance>) {
  const wantsAgreement = useWatch({ control, name: "wantsAdvanceAgreement" });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const creditMethod = useWatch({ control, name: "creditMethod" });
  const paymentScheduleType = useWatch({ control, name: "paymentScheduleType" });
  const paymentSchedule = useWatch({ control, name: "paymentSchedule" }) ?? [];
  const {
    fields: paymentFields,
    append: appendPayment,
    remove: removePayment,
  } = useFieldArray({ control, name: "paymentSchedule", keyName: "fieldKey" });

  return (
    <div className="flex flex-col gap-5">
      <Alert variant="warning" role="note" className="text-sm">
        This produces a <strong>Pre-Judgment Housing Advance and Lump-Sum Credit Agreement</strong>, not a
        court order or a guaranteed enforceable promissory note. It records the parties&rsquo; intended payment
        obligation and settlement credit. Florida counsel should review it before either party signs or transfers funds.
      </Alert>
      <YesNoField
        id="wantsAdvanceAgreement"
        legend="Do you want a separate pre-judgment housing advance agreement?"
        required
        registration={register("wantsAdvanceAgreement")}
        error={errors.wantsAdvanceAgreement?.message}
      />
      {wantsAgreement === "yes" ? (
        <>
          <TextField
            id="payerFullLegalName"
            label="Paying spouse's full legal name"
            required
            registration={register("payerFullLegalName")}
            error={errors.payerFullLegalName?.message}
          />
          <TextField
            id="recipientFullLegalName"
            label="Receiving spouse's full legal name"
            required
            registration={register("recipientFullLegalName")}
            error={errors.recipientFullLegalName?.message}
          />
          <MoneyField
            id="finalSettlementAmount"
            label="Total proposed lump-sum alimony settlement"
            required
            registration={register("finalSettlementAmount")}
            error={errors.finalSettlementAmount?.message}
          />
          <MoneyField
            id="advanceAmount"
            label="Total housing advance paid before final judgment"
            required
            registration={register("advanceAmount")}
            error={errors.advanceAmount?.message}
          />
          <RadioGroupField
            id="purpose"
            legend="What is the advance for?"
            required
            registration={register("purpose")}
            error={errors.purpose?.message}
            options={[
              { value: "housing_transition", label: "Housing transition, relocation, deposit, or moving costs" },
              { value: "other", label: "Another agreed transition expense" },
            ]}
          />
          <TextareaField
            id="intendedUseDetails"
            label="Describe the intended use"
            hint="For example: security deposit, first month's rent, utility deposits, and reasonable moving expenses."
            required
            registration={register("intendedUseDetails")}
            error={errors.intendedUseDetails?.message}
          />
          <DateField
            id="targetMoveDate"
            label="Target move date, if known"
            registration={register("targetMoveDate")}
            error={errors.targetMoveDate?.message}
          />
          <RadioGroupField
            id="paymentScheduleType"
            legend="How will the advance be paid?"
            required
            registration={register("paymentScheduleType")}
            error={errors.paymentScheduleType?.message}
            options={[
              { value: "single_payment", label: "One payment" },
              { value: "installments", label: "An installment schedule" },
            ]}
          />
          {paymentScheduleType === "single_payment" ? (
            <DateField
              id="paymentDueDate"
              label="Payment due date"
              required
              registration={register("paymentDueDate")}
              error={errors.paymentDueDate?.message}
            />
          ) : null}
          {paymentScheduleType === "installments" ? (
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2 p-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">Installment schedule</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Add each due date and amount. The schedule must equal the total housing advance.
                </p>
              </div>
              {paymentFields.map((field, index) => {
                const paymentErrors = errors.paymentSchedule?.[index];
                return (
                  <fieldset key={field.fieldKey} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
                    <legend className="px-1 text-base font-semibold text-ink">
                      Payment {index + 1}
                    </legend>
                    <input type="hidden" {...register(`paymentSchedule.${index}.id`)} />
                    <DateField
                      id={`advance-payment-${index}-date`}
                      label="Due date"
                      required
                      registration={register(`paymentSchedule.${index}.dueDate`)}
                      error={paymentErrors?.dueDate?.message}
                    />
                    <MoneyField
                      id={`advance-payment-${index}-amount`}
                      label="Amount"
                      required
                      registration={register(`paymentSchedule.${index}.amount`)}
                      error={paymentErrors?.amount?.message}
                    />
                    <TextField
                      id={`advance-payment-${index}-note`}
                      label="Payment note"
                      registration={register(`paymentSchedule.${index}.note`)}
                      error={paymentErrors?.note?.message}
                    />
                    <button type="button" onClick={() => removePayment(index)} className={`${dangerLinkClasses} self-start`}>
                      Remove payment {index + 1}
                    </button>
                  </fieldset>
                );
              })}
              <button
                type="button"
                onClick={() => appendPayment({ id: generatePaymentId(), dueDate: "", amount: 0, note: "" })}
                className={`${secondaryButtonClasses} self-start`}
              >
                + Add scheduled payment
              </button>
              {typeof errors.paymentSchedule?.message === "string" ? (
                <p role="alert" className="text-sm font-medium text-danger-solid">
                  {errors.paymentSchedule.message}
                </p>
              ) : null}
              <p className="text-sm text-ink-muted">
                Scheduled payments entered: {paymentSchedule.length}
              </p>
            </section>
          ) : null}
          <RadioGroupField
            id="paymentMethod"
            legend="Payment method"
            required
            registration={register("paymentMethod")}
            error={errors.paymentMethod?.message}
            options={[
              { value: "cashiers_check", label: "Cashier's check" },
              { value: "wire_transfer", label: "Wire transfer" },
              { value: "attorney_trust", label: "Attorney trust account" },
              { value: "other", label: "Other" },
            ]}
          />
          {paymentMethod === "other" ? (
            <TextField
              id="paymentMethodDetails"
              label="Describe the payment method"
              required
              registration={register("paymentMethodDetails")}
              error={errors.paymentMethodDetails?.message}
            />
          ) : null}
          <RadioGroupField
            id="creditMethod"
            legend="How is the payment credited against the final settlement?"
            required
            registration={register("creditMethod")}
            error={errors.creditMethod?.message}
            options={[
              { value: "dollar_for_dollar", label: "Dollar-for-dollar reduction of the remaining settlement balance" },
              { value: "other", label: "Other credit method" },
            ]}
          />
          {creditMethod === "other" ? (
            <TextareaField
              id="creditDetails"
              label="Describe the credit method"
              required
              registration={register("creditDetails")}
              error={errors.creditDetails?.message}
            />
          ) : null}
          <RadioGroupField
            id="ifFinalAgreementNotEntered"
            legend="What happens if no final settlement agreement or judgment is entered?"
            required
            registration={register("ifFinalAgreementNotEntered")}
            error={errors.ifFinalAgreementNotEntered?.message}
            options={[
              { value: "refund", label: "The recipient refunds the advance" },
              { value: "escrow_pending_agreement", label: "Funds remain in attorney escrow pending written agreement" },
              { value: "nonrefundable", label: "The parties intend the payment to be nonrefundable" },
              { value: "attorney_to_confirm", label: "Attorney must specify this term before signing" },
            ]}
          />
          <YesNoField
            id="clearedFundsRequired"
            legend="Does the credit apply only after the funds clear?"
            required
            registration={register("clearedFundsRequired")}
            error={errors.clearedFundsRequired?.message}
          />
          <TextareaField
            id="advanceNotes"
            label="Other advance-payment terms"
            registration={register("advanceNotes")}
            error={errors.advanceNotes?.message}
          />
        </>
      ) : null}
    </div>
  );
}
