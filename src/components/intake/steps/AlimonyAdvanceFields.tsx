"use client";

import { useWatch } from "react-hook-form";

import type { AlimonyAdvance } from "@/domain/intake";
import { Alert } from "@/components/ui";

import { DateField, MoneyField, RadioGroupField, TextareaField, TextField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function AlimonyAdvanceFields({ register, errors, control }: StepFieldsProps<AlimonyAdvance>) {
  const wantsAgreement = useWatch({ control, name: "wantsAdvanceAgreement" });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const creditMethod = useWatch({ control, name: "creditMethod" });

  return (
    <div className="flex flex-col gap-5">
      <Alert variant="warning" role="note" className="text-sm">
        This produces an <strong>Alimony Settlement Advance and Credit Acknowledgment</strong>, not a
        promissory note. It documents money actually paid before final judgment and how the parties intend
        it to be credited. Florida counsel should review it before either party signs or transfers funds.
      </Alert>
      <YesNoField
        id="wantsAdvanceAgreement"
        legend="Do you want a separate advance-payment credit agreement?"
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
            label="Total agreed alimony settlement amount"
            required
            registration={register("finalSettlementAmount")}
            error={errors.finalSettlementAmount?.message}
          />
          <MoneyField
            id="advanceAmount"
            label="Amount paid before final judgment"
            required
            registration={register("advanceAmount")}
            error={errors.advanceAmount?.message}
          />
          <DateField
            id="paymentDueDate"
            label="Advance-payment due date"
            required
            registration={register("paymentDueDate")}
            error={errors.paymentDueDate?.message}
          />
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
