"use client";

import { useFieldArray, useWatch } from "react-hook-form";

import type { FilingDetails } from "@/domain/intake";

import { DateField, RadioGroupField, TextareaField, TextField, YesNoField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

/**
 * The one section whose answers never reach a calculation.
 *
 * Everything here exists so an attorney can prepare court forms, which ask for
 * identifying details the estimate has no use for. That is why it is opt-in and
 * why it sits last: someone who only wants an estimate should never be asked
 * for their home address. Social Security numbers are deliberately absent —
 * form 12.902(j) needs them, but collecting them here would add risk without
 * adding capability, so the packet says to complete that form by hand.
 */
export function FilingDetailsFields({ register, errors, control }: StepFieldsProps<FilingDetails>) {
  const wantsPacket = useWatch({ control, name: "wantsFilingPacket" });
  const residency = useWatch({ control, name: "whichPartyIsFloridaResident" });
  const restoreName = useWatch({ control, name: "formerNameRestorationRequested" });
  const { fields } = useFieldArray({ control, name: "children" });

  return (
    <div className="flex flex-col gap-6">
      <YesNoField
        id="wantsFilingPacket"
        legend="Do you want an attorney filing packet?"
        hint="Answer no to skip this section entirely. Your estimate is exactly the same either way."
        required
        registration={register("wantsFilingPacket")}
        error={errors.wantsFilingPacket?.message}
      />

      {wantsPacket !== "yes" ? (
        <p className="text-sm text-ink-muted">
          Nothing else is asked here. You can turn this on later if you decide to take your answers to an attorney.
        </p>
      ) : (
        <>
          <p className="rounded-lg bg-surface-muted p-4 text-sm text-ink-muted">
            These details go into court forms, not into any calculation. This app does not file anything for you and
            does not draft your settlement agreement — it gives an attorney the information they need to do both.
          </p>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">About you</legend>
            <TextField
              id="you.fullLegalName"
              label="Your full legal name"
              hint="As it appears on your government ID, not a nickname."
              required
              registration={register("you.fullLegalName")}
              error={errors.you?.fullLegalName?.message}
            />
            <DateField
              id="you.dateOfBirth"
              label="Your date of birth"
              registration={register("you.dateOfBirth")}
              error={errors.you?.dateOfBirth?.message}
            />
            <TextField
              id="you.address.street"
              label="Your street address"
              registration={register("you.address.street")}
              error={errors.you?.address?.street?.message}
            />
            <TextField
              id="you.address.city"
              label="City"
              registration={register("you.address.city")}
              error={errors.you?.address?.city?.message}
            />
            <TextField
              id="you.address.state"
              label="State"
              registration={register("you.address.state")}
              error={errors.you?.address?.state?.message}
            />
            <TextField
              id="you.address.postalCode"
              label="ZIP code"
              registration={register("you.address.postalCode")}
              error={errors.you?.address?.postalCode?.message}
            />
            <TextField
              id="you.employerName"
              label="Your employer's name"
              hint="Leave blank if you are not employed."
              registration={register("you.employerName")}
              error={errors.you?.employerName?.message}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">About your spouse</legend>
            <TextField
              id="spouse.fullLegalName"
              label="Your spouse's full legal name"
              required
              registration={register("spouse.fullLegalName")}
              error={errors.spouse?.fullLegalName?.message}
            />
            <DateField
              id="spouse.dateOfBirth"
              label="Your spouse's date of birth"
              registration={register("spouse.dateOfBirth")}
              error={errors.spouse?.dateOfBirth?.message}
            />
            <TextField
              id="spouse.address.street"
              label="Your spouse's street address"
              hint="Leave blank if you do not know it, or if sharing it would not be safe."
              registration={register("spouse.address.street")}
              error={errors.spouse?.address?.street?.message}
            />
            <TextField
              id="spouse.address.city"
              label="City"
              registration={register("spouse.address.city")}
              error={errors.spouse?.address?.city?.message}
            />
            <TextField
              id="spouse.address.state"
              label="State"
              registration={register("spouse.address.state")}
              error={errors.spouse?.address?.state?.message}
            />
            <TextField
              id="spouse.address.postalCode"
              label="ZIP code"
              registration={register("spouse.address.postalCode")}
              error={errors.spouse?.address?.postalCode?.message}
            />
            <TextField
              id="spouse.employerName"
              label="Your spouse's employer's name"
              registration={register("spouse.employerName")}
              error={errors.spouse?.employerName?.message}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">The marriage</legend>
            <TextField
              id="marriagePlaceCity"
              label="City where you married"
              registration={register("marriagePlaceCity")}
              error={errors.marriagePlaceCity?.message}
            />
            <TextField
              id="marriagePlaceStateOrCountry"
              label="State or country where you married"
              registration={register("marriagePlaceStateOrCountry")}
              error={errors.marriagePlaceStateOrCountry?.message}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">Florida residence</legend>
            <p className="text-sm text-ink-muted">
              Florida law requires one spouse to have lived in Florida for at least six months before a dissolution is
              filed. We ask for the date rather than a yes-or-no so the packet can show the arithmetic.
            </p>
            <RadioGroupField
              id="whichPartyIsFloridaResident"
              legend="Who has lived in Florida?"
              required
              registration={register("whichPartyIsFloridaResident")}
              error={errors.whichPartyIsFloridaResident?.message}
              options={[
                { value: "you", label: "Me" },
                { value: "spouse", label: "My spouse" },
                { value: "both", label: "Both of us" },
                { value: "neither", label: "Neither of us" },
              ]}
            />
            {residency && residency !== "neither" ? (
              <DateField
                id="floridaResidentSince"
                label="Date that Florida residence began"
                hint="If both of you qualify, use the earlier date."
                required
                registration={register("floridaResidentSince")}
                error={errors.floridaResidentSince?.message}
              />
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">Former name</legend>
            <YesNoField
              id="formerNameRestorationRequested"
              legend="Is either spouse asking the court to restore a former name?"
              registration={register("formerNameRestorationRequested")}
              error={errors.formerNameRestorationRequested?.message}
            />
            {restoreName === "yes" ? (
              <TextField
                id="formerNameToRestore"
                label="Former name to restore"
                required
                registration={register("formerNameToRestore")}
                error={errors.formerNameToRestore?.message}
              />
            ) : null}
          </fieldset>

          {fields.length > 0 ? (
            <fieldset className="flex flex-col gap-5">
              <legend className="text-base font-semibold text-ink">Children&apos;s filing details</legend>
              <p className="text-sm text-ink-muted">
                One block per child you already entered. The UCCJEA affidavit asks for each child&apos;s full legal
                name and where they have lived for the last five years, which is more than the estimate needed.
              </p>
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col gap-4 rounded-lg border border-line p-4">
                  <TextField
                    id={`children.${index}.fullLegalName`}
                    label="Child's full legal name"
                    hint="The estimate only needed initials; the court needs the full name."
                    registration={register(`children.${index}.fullLegalName`)}
                    error={errors.children?.[index]?.fullLegalName?.message}
                  />
                  <TextareaField
                    id={`children.${index}.addressHistory`}
                    label="Where this child has lived for the last five years"
                    hint="City and state for each place, with rough dates and who they lived with."
                    registration={register(`children.${index}.addressHistory`)}
                    error={errors.children?.[index]?.addressHistory?.message}
                  />
                </div>
              ))}
            </fieldset>
          ) : null}
        </>
      )}
    </div>
  );
}
