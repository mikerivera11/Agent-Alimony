"use client";

import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import type { FilingDetails } from "@/domain/intake";

import { DateField, RadioGroupField, TextField, YesNoField } from "../fields";
import { secondaryButtonClasses } from "../fields/inputStyles";
import type { StepFieldsProps } from "./StepFieldsProps";

function ChildFilingDetailsBlock({
  index,
  register,
  errors,
  control,
}: {
  index: number;
  register: UseFormRegister<FilingDetails>;
  errors: FieldErrors<FilingDetails>;
  control: Control<FilingDetails>;
}) {
  const residences = useFieldArray({
    control,
    name: `children.${index}.residences`,
  });
  const childErrors = errors.children?.[index];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <TextField
        id={`children.${index}.fullLegalName`}
        label="Child's full legal name"
        hint="The estimate only needed initials; the court forms require the full legal name."
        required
        registration={register(`children.${index}.fullLegalName`)}
        error={childErrors?.fullLegalName?.message}
      />
      <TextField
        id={`children.${index}.placeOfBirth`}
        label="Child's place of birth"
        hint="City and state, or city and country."
        required
        registration={register(`children.${index}.placeOfBirth`)}
        error={childErrors?.placeOfBirth?.message}
      />
      <RadioGroupField
        id={`children.${index}.sex`}
        legend="What should be entered in the official form's sex field?"
        required
        registration={register(`children.${index}.sex`)}
        error={childErrors?.sex?.message}
        options={[
          { value: "female", label: "Female" },
          { value: "male", label: "Male" },
          { value: "another_or_not_listed", label: "Another entry or not listed — leave for review" },
        ]}
      />

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="font-semibold text-ink">Residences during the last five years</h4>
          <p className="text-sm text-ink-muted">
            Add the current residence first, then each earlier residence needed to cover the full five-year period.
            The official UCCJEA form has room for six entries per child.
          </p>
        </div>
        {residences.fields.map((residence, residenceIndex) => (
          <div key={residence.id} className="flex flex-col gap-3 rounded-lg bg-surface-muted p-4">
            <TextField
              id={`children.${index}.residences.${residenceIndex}.address`}
              label={residenceIndex === 0 ? "Current address" : "Previous address"}
              required
              registration={register(`children.${index}.residences.${residenceIndex}.address`)}
              error={childErrors?.residences?.[residenceIndex]?.address?.message}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <DateField
                id={`children.${index}.residences.${residenceIndex}.fromDate`}
                label="From"
                required
                registration={register(`children.${index}.residences.${residenceIndex}.fromDate`)}
                error={childErrors?.residences?.[residenceIndex]?.fromDate?.message}
              />
              <DateField
                id={`children.${index}.residences.${residenceIndex}.untilDate`}
                label="Until"
                hint={residenceIndex === 0 ? "Leave blank if this is the current residence." : undefined}
                registration={register(`children.${index}.residences.${residenceIndex}.untilDate`)}
                error={childErrors?.residences?.[residenceIndex]?.untilDate?.message}
              />
            </div>
            <TextField
              id={`children.${index}.residences.${residenceIndex}.livedWithNameAndAddress`}
              label="Name and address of each person the child lived with"
              required
              registration={register(`children.${index}.residences.${residenceIndex}.livedWithNameAndAddress`)}
              error={childErrors?.residences?.[residenceIndex]?.livedWithNameAndAddress?.message}
            />
            <TextField
              id={`children.${index}.residences.${residenceIndex}.relationship`}
              label="That person's relationship to the child"
              required
              registration={register(`children.${index}.residences.${residenceIndex}.relationship`)}
              error={childErrors?.residences?.[residenceIndex]?.relationship?.message}
            />
            <button
              type="button"
              className={secondaryButtonClasses}
              onClick={() => residences.remove(residenceIndex)}
            >
              Remove this residence
            </button>
          </div>
        ))}
        {typeof childErrors?.residences?.message === "string" ? (
          <p className="text-sm text-danger" role="alert">
            {childErrors.residences.message}
          </p>
        ) : null}
        {residences.fields.length < 6 ? (
          <button
            type="button"
            className={secondaryButtonClasses}
            onClick={() =>
              residences.append({
                address: "",
                fromDate: "",
                untilDate: undefined,
                livedWithNameAndAddress: "",
                relationship: "",
              })
            }
          >
            Add a residence
          </button>
        ) : null}
      </div>
    </div>
  );
}

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
  const pregnancy = useWatch({ control, name: "pregnancyStatus" });
  const nonCommonChildren = useWatch({ control, name: "nonCommonMinorChildrenStatus" });
  const adultDependentChildren = useWatch({ control, name: "adultDependentChildrenStatus" });
  const propertyRequest = useWatch({ control, name: "propertyDistributionRequest" });
  const currentResidence = useWatch({ control, name: "childrenCurrentResidence" });
  const responsibility = useWatch({ control, name: "parentalResponsibilityRequest" });
  const retroactiveSupport = useWatch({ control, name: "retroactiveChildSupportStart" });
  const supportBeyondEighteen = useWatch({ control, name: "supportBeyondEighteen" });
  const restoreName = useWatch({ control, name: "formerNameRestorationRequested" });
  const priorProceeding = useWatch({ control, name: "priorCustodyProceedingStatus" });
  const pendingProceeding = useWatch({ control, name: "pendingCustodyProceedingStatus" });
  const thirdPartyClaim = useWatch({ control, name: "thirdPartyCustodyClaimStatus" });
  const supportOrder = useWatch({ control, name: "existingChildSupportOrderStatus" });
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
            These questions correspond to fields in the supported Florida court forms. The app does not sign, swear,
            notarize, serve, or file anything, and legal elections still require attorney review.
          </p>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">Court case information</legend>
            <p className="text-sm text-ink-muted">
              If the clerk has not assigned these values yet, leave them blank. They remain visibly blank on the
              review draft rather than being guessed.
            </p>
            <TextField
              id="judicialCircuit"
              label="Judicial circuit"
              hint="For example, Ninth Judicial Circuit."
              registration={register("judicialCircuit")}
              error={errors.judicialCircuit?.message}
            />
            <TextField
              id="caseNumber"
              label="Case number"
              registration={register("caseNumber")}
              error={errors.caseNumber?.message}
            />
            <TextField
              id="division"
              label="Division"
              registration={register("division")}
              error={errors.division?.message}
            />
            <RadioGroupField
              id="relatedCasesStatus"
              legend="Are there related family cases involving these parties or children?"
              required
              registration={register("relatedCasesStatus")}
              error={errors.relatedCasesStatus?.message}
              options={[
                { value: "none", label: "No, to the best of my knowledge" },
                { value: "listed_separately", label: "Yes — they will be listed on Form 12.900(h)" },
                { value: "not_sure", label: "I am not sure — leave for attorney review" },
              ]}
            />
          </fieldset>

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
              id="you.phoneNumber"
              label="Your telephone number"
              required
              registration={register("you.phoneNumber")}
              error={errors.you?.phoneNumber?.message}
            />
            <TextField
              id="you.emailAddress"
              label="Your designated email address"
              hint="Court forms use this for service and contact information."
              required
              registration={register("you.emailAddress")}
              error={errors.you?.emailAddress?.message}
            />
            <RadioGroupField
              id="you.militaryService"
              legend="Your current military-service status"
              required
              registration={register("you.militaryService")}
              error={errors.you?.militaryService?.message}
              options={[
                { value: "none", label: "Not serving" },
                { value: "active_duty", label: "Active duty" },
                { value: "reserve_or_guard", label: "Reserve or National Guard" },
                { value: "not_sure", label: "Not sure — attorney review needed" },
              ]}
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
              id="spouse.phoneNumber"
              label="Your spouse's telephone number"
              hint="Leave blank if unknown or unsafe to provide."
              registration={register("spouse.phoneNumber")}
              error={errors.spouse?.phoneNumber?.message}
            />
            <TextField
              id="spouse.emailAddress"
              label="Your spouse's email address"
              hint="Leave blank if unknown."
              registration={register("spouse.emailAddress")}
              error={errors.spouse?.emailAddress?.message}
            />
            <RadioGroupField
              id="spouse.militaryService"
              legend="Your spouse's current military-service status"
              required
              registration={register("spouse.militaryService")}
              error={errors.spouse?.militaryService?.message}
              options={[
                { value: "none", label: "Not serving" },
                { value: "active_duty", label: "Active duty" },
                { value: "reserve_or_guard", label: "Reserve or National Guard" },
                { value: "not_sure", label: "Not sure — attorney review needed" },
              ]}
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
            <RadioGroupField
              id="marriageGround"
              legend="Why should the marriage be dissolved?"
              required
              registration={register("marriageGround")}
              error={errors.marriageGround?.message}
              options={[
                { value: "irretrievably_broken", label: "The marriage is irretrievably broken" },
                {
                  value: "mental_incapacity",
                  label: "A party has been adjudged mentally incapacitated for at least three years",
                },
              ]}
            />
            <RadioGroupField
              id="financialAffidavitStatus"
              legend="When will the petitioner's financial affidavit be filed?"
              required
              registration={register("financialAffidavitStatus")}
              error={errors.financialAffidavitStatus?.message}
              options={[
                { value: "filed_with_petition", label: "Filed with the petition" },
                { value: "will_be_timely_filed", label: "Will be timely filed" },
              ]}
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
            <legend className="text-base font-semibold text-ink">Petition child and pregnancy questions</legend>
            <RadioGroupField
              id="pregnancyStatus"
              legend="Is either party pregnant?"
              required
              registration={register("pregnancyStatus")}
              error={errors.pregnancyStatus?.message}
              options={[
                { value: "none", label: "No" },
                { value: "petitioner", label: "Yes — the petitioner" },
                { value: "respondent", label: "Yes — the respondent" },
              ]}
            />
            {pregnancy && pregnancy !== "none" ? (
              <DateField
                id="pregnancyDueDate"
                label="Expected due date"
                required
                registration={register("pregnancyDueDate")}
                error={errors.pregnancyDueDate?.message}
              />
            ) : null}
            <YesNoField
              id="nonCommonMinorChildrenStatus"
              legend="Were any minor children born or conceived during the marriage who are not common to both parties?"
              required
              registration={register("nonCommonMinorChildrenStatus")}
              error={errors.nonCommonMinorChildrenStatus?.message}
            />
            {nonCommonChildren === "yes" ? (
              <TextField
                id="nonCommonMinorChildrenDetails"
                label="Child names, birth dates, and each birth parent's name and address"
                required
                registration={register("nonCommonMinorChildrenDetails")}
                error={errors.nonCommonMinorChildrenDetails?.message}
              />
            ) : null}
            <YesNoField
              id="adultDependentChildrenStatus"
              legend="Are any children common to both parties age 18 or older and dependent because of a mental or physical disability?"
              required
              registration={register("adultDependentChildrenStatus")}
              error={errors.adultDependentChildrenStatus?.message}
            />
            {adultDependentChildren === "yes" ? (
              <TextField
                id="adultDependentChildrenDetails"
                label="Adult dependent child names, birth dates, and disability details"
                required
                registration={register("adultDependentChildrenDetails")}
                error={errors.adultDependentChildrenDetails?.message}
              />
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">Property request in the petition</legend>
            <RadioGroupField
              id="propertyDistributionRequest"
              legend="How should the petition ask the court to address marital assets and liabilities?"
              required
              registration={register("propertyDistributionRequest")}
              error={errors.propertyDistributionRequest?.message}
              options={[
                { value: "written_agreement", label: "Use the parties' attached written agreement" },
                { value: "court_determination", label: "Ask the court to determine distribution" },
                {
                  value: "other_property_interest",
                  label: "Also request an interest in the other spouse's property",
                },
              ]}
            />
            {propertyRequest === "other_property_interest" ? (
              <>
                <RadioGroupField
                  id="propertyInterestRecipient"
                  legend="Who should receive that property interest?"
                  required
                  registration={register("propertyInterestRecipient")}
                  error={errors.propertyInterestRecipient?.message}
                  options={[
                    { value: "petitioner", label: "Petitioner" },
                    { value: "respondent", label: "Respondent" },
                  ]}
                />
                <TextField
                  id="propertyInterestExplanation"
                  label="Explain the requested interest"
                  required
                  registration={register("propertyInterestExplanation")}
                  error={errors.propertyInterestExplanation?.message}
                />
              </>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">Parenting request in the petition</legend>
            <RadioGroupField
              id="childrenCurrentResidence"
              legend="With whom do the minor children currently reside?"
              required
              registration={register("childrenCurrentResidence")}
              error={errors.childrenCurrentResidence?.message}
              options={[
                { value: "petitioner", label: "Petitioner" },
                { value: "respondent", label: "Respondent" },
                { value: "other", label: "Another arrangement" },
              ]}
            />
            {currentResidence === "other" ? (
              <TextField
                id="childrenCurrentResidenceExplanation"
                label="Explain the current residence arrangement"
                required
                registration={register("childrenCurrentResidenceExplanation")}
                error={errors.childrenCurrentResidenceExplanation?.message}
              />
            ) : null}
            <RadioGroupField
              id="parentalResponsibilityRequest"
              legend="What parental-responsibility arrangement should the petition request?"
              required
              registration={register("parentalResponsibilityRequest")}
              error={errors.parentalResponsibilityRequest?.message}
              options={[
                { value: "shared", label: "Shared by both parents" },
                { value: "sole_petitioner", label: "Solely to the petitioner" },
                { value: "sole_respondent", label: "Solely to the respondent" },
              ]}
            />
            {responsibility === "sole_petitioner" || responsibility === "sole_respondent" ? (
              <TextField
                id="soleResponsibilityDetrimentExplanation"
                label="Why would shared parental responsibility be detrimental to the children?"
                required
                registration={register("soleResponsibilityDetrimentExplanation")}
                error={errors.soleResponsibilityDetrimentExplanation?.message}
              />
            ) : null}
            <YesNoField
              id="parentingPlanIncludesTimeSharing"
              legend="Does the requested parenting plan include parental time-sharing?"
              required
              registration={register("parentingPlanIncludesTimeSharing")}
              error={errors.parentingPlanIncludesTimeSharing?.message}
            />
            <TextField
              id="parentingBestInterestsExplanation"
              label="Why is the requested parenting plan in the children's best interests?"
              required
              registration={register("parentingBestInterestsExplanation")}
              error={errors.parentingBestInterestsExplanation?.message}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">Child-support request in the petition</legend>
            <RadioGroupField
              id="childSupportWorksheetStatus"
              legend="When will the Child Support Guidelines Worksheet be filed?"
              required
              registration={register("childSupportWorksheetStatus")}
              error={errors.childSupportWorksheetStatus?.message}
              options={[
                { value: "filed_with_petition", label: "Filed with the petition" },
                { value: "will_be_timely_filed", label: "Will be timely filed" },
              ]}
            />
            <RadioGroupField
              id="retroactiveChildSupportStart"
              legend="Is retroactive child support requested?"
              required
              registration={register("retroactiveChildSupportStart")}
              error={errors.retroactiveChildSupportStart?.message}
              options={[
                { value: "none", label: "No" },
                { value: "separation", label: "Yes — from the date of separation" },
                { value: "filing", label: "Yes — from the petition filing date" },
                { value: "other", label: "Yes — from another date" },
              ]}
            />
            {retroactiveSupport === "other" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  id="retroactiveChildSupportOtherDate"
                  label="Other requested start date"
                  required
                  registration={register("retroactiveChildSupportOtherDate")}
                  error={errors.retroactiveChildSupportOtherDate?.message}
                />
                <TextField
                  id="retroactiveChildSupportOtherExplanation"
                  label="Why this date is requested"
                  required
                  registration={register("retroactiveChildSupportOtherExplanation")}
                  error={errors.retroactiveChildSupportOtherExplanation?.message}
                />
              </div>
            ) : null}
            <RadioGroupField
              id="supportBeyondEighteen"
              legend="Is child support requested beyond age 18?"
              required
              registration={register("supportBeyondEighteen")}
              error={errors.supportBeyondEighteen?.message}
              options={[
                { value: "none", label: "No" },
                { value: "incapacity", label: "Yes — because of qualifying incapacity" },
                { value: "high_school", label: "Yes — for a dependent child age 18 to 19 still in high school" },
              ]}
            />
            {supportBeyondEighteen && supportBeyondEighteen !== "none" ? (
              <TextField
                id="supportBeyondEighteenDetails"
                label="Identify the child and explain the request"
                required
                registration={register("supportBeyondEighteenDetails")}
                error={errors.supportBeyondEighteenDetails?.message}
              />
            ) : null}
            <YesNoField
              id="childSupportDeviationRequested"
              legend="Does the petitioner request child support above or below the guidelines?"
              required
              registration={register("childSupportDeviationRequested")}
              error={errors.childSupportDeviationRequested?.message}
            />
            <TextField
              id="otherReliefRequested"
              label="Other relief requested, if any"
              registration={register("otherReliefRequested")}
              error={errors.otherReliefRequested?.message}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-ink">Former name</legend>
            <YesNoField
              id="formerNameRestorationRequested"
              legend="Is the petitioner asking the court to restore a former name?"
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
                <ChildFilingDetailsBlock
                  key={field.id}
                  index={index}
                  register={register}
                  errors={errors}
                  control={control}
                />
              ))}
            </fieldset>
          ) : null}

          {fields.length > 0 ? (
            <fieldset className="flex flex-col gap-5">
              <legend className="text-base font-semibold text-ink">UCCJEA case-history questions</legend>
              <p className="text-sm text-ink-muted">
                These are sworn questions on Form 12.902(d). Answer from your own knowledge; do not guess.
              </p>
              <RadioGroupField
                id="priorCustodyProceedingStatus"
                legend="Have you participated in any previous custody or time-sharing proceeding involving these children?"
                required
                registration={register("priorCustodyProceedingStatus")}
                error={errors.priorCustodyProceedingStatus?.message}
                options={[
                  { value: "none", label: "No" },
                  { value: "exists", label: "Yes" },
                  { value: "not_sure", label: "Not sure — attorney review needed" },
                ]}
              />
              {priorProceeding === "exists" ? (
                <div className="grid gap-4 rounded-lg bg-surface-muted p-4 sm:grid-cols-2">
                  <TextField
                    id="priorCustodyProceedingDetails.childNames"
                    label="Child name(s)"
                    required
                    registration={register("priorCustodyProceedingDetails.childNames")}
                    error={errors.priorCustodyProceedingDetails?.childNames?.message}
                  />
                  <TextField
                    id="priorCustodyProceedingDetails.proceedingType"
                    label="Type of proceeding"
                    required
                    registration={register("priorCustodyProceedingDetails.proceedingType")}
                    error={errors.priorCustodyProceedingDetails?.proceedingType?.message}
                  />
                  <TextField
                    id="priorCustodyProceedingDetails.courtAndState"
                    label="Court and state"
                    required
                    registration={register("priorCustodyProceedingDetails.courtAndState")}
                    error={errors.priorCustodyProceedingDetails?.courtAndState?.message}
                  />
                  <DateField
                    id="priorCustodyProceedingDetails.orderDate"
                    label="Date of order or judgment, if any"
                    registration={register("priorCustodyProceedingDetails.orderDate")}
                    error={errors.priorCustodyProceedingDetails?.orderDate?.message}
                  />
                </div>
              ) : null}
              <RadioGroupField
                id="pendingCustodyProceedingStatus"
                legend="Do you know of any custody or time-sharing proceeding currently pending involving these children?"
                required
                registration={register("pendingCustodyProceedingStatus")}
                error={errors.pendingCustodyProceedingStatus?.message}
                options={[
                  { value: "none", label: "No" },
                  { value: "exists", label: "Yes" },
                  { value: "not_sure", label: "Not sure — attorney review needed" },
                ]}
              />
              {pendingProceeding === "exists" ? (
                <div className="grid gap-4 rounded-lg bg-surface-muted p-4 sm:grid-cols-2">
                  <TextField
                    id="pendingCustodyProceedingDetails.childNames"
                    label="Child name(s)"
                    required
                    registration={register("pendingCustodyProceedingDetails.childNames")}
                    error={errors.pendingCustodyProceedingDetails?.childNames?.message}
                  />
                  <TextField
                    id="pendingCustodyProceedingDetails.proceedingType"
                    label="Type of proceeding"
                    required
                    registration={register("pendingCustodyProceedingDetails.proceedingType")}
                    error={errors.pendingCustodyProceedingDetails?.proceedingType?.message}
                  />
                  <TextField
                    id="pendingCustodyProceedingDetails.courtAndState"
                    label="Court and state"
                    required
                    registration={register("pendingCustodyProceedingDetails.courtAndState")}
                    error={errors.pendingCustodyProceedingDetails?.courtAndState?.message}
                  />
                  <TextField
                    id="pendingCustodyProceedingDetails.caseNumber"
                    label="Case number"
                    required
                    registration={register("pendingCustodyProceedingDetails.caseNumber")}
                    error={errors.pendingCustodyProceedingDetails?.caseNumber?.message}
                  />
                  <DateField
                    id="pendingCustodyProceedingDetails.orderDate"
                    label="Date of order or judgment, if any"
                    registration={register("pendingCustodyProceedingDetails.orderDate")}
                    error={errors.pendingCustodyProceedingDetails?.orderDate?.message}
                  />
                </div>
              ) : null}
              <RadioGroupField
                id="thirdPartyCustodyClaimStatus"
                legend="Do you know of anyone outside this case who has physical custody or claims custody, visitation, or time-sharing rights?"
                required
                registration={register("thirdPartyCustodyClaimStatus")}
                error={errors.thirdPartyCustodyClaimStatus?.message}
                options={[
                  { value: "none", label: "No" },
                  { value: "exists", label: "Yes" },
                  { value: "not_sure", label: "Not sure — attorney review needed" },
                ]}
              />
              {thirdPartyClaim === "exists" ? (
                <div className="flex flex-col gap-4 rounded-lg bg-surface-muted p-4">
                  <TextField
                    id="thirdPartyCustodyClaimDetails.nameAndAddress"
                    label="Person's name and address"
                    required
                    registration={register("thirdPartyCustodyClaimDetails.nameAndAddress")}
                    error={errors.thirdPartyCustodyClaimDetails?.nameAndAddress?.message}
                  />
                  <TextField
                    id="thirdPartyCustodyClaimDetails.childNames"
                    label="Affected child name(s)"
                    required
                    registration={register("thirdPartyCustodyClaimDetails.childNames")}
                    error={errors.thirdPartyCustodyClaimDetails?.childNames?.message}
                  />
                  <TextField
                    id="thirdPartyCustodyClaimDetails.relationshipToChildren"
                    label="Relationship to the child or children"
                    required
                    registration={register("thirdPartyCustodyClaimDetails.relationshipToChildren")}
                    error={errors.thirdPartyCustodyClaimDetails?.relationshipToChildren?.message}
                  />
                  <RadioGroupField
                    id="thirdPartyCustodyClaimDetails.claimType"
                    legend="What right does this person have or claim?"
                    required
                    registration={register("thirdPartyCustodyClaimDetails.claimType")}
                    error={errors.thirdPartyCustodyClaimDetails?.claimType?.message}
                    options={[
                      { value: "physical_custody", label: "Has physical custody" },
                      { value: "custody_rights", label: "Claims custody rights" },
                      { value: "visitation_or_time_sharing", label: "Claims visitation or time-sharing" },
                    ]}
                  />
                </div>
              ) : null}
              <RadioGroupField
                id="existingChildSupportOrderStatus"
                legend="Are any of these children already subject to a child-support order?"
                required
                registration={register("existingChildSupportOrderStatus")}
                error={errors.existingChildSupportOrderStatus?.message}
                options={[
                  { value: "none", label: "No" },
                  { value: "exists", label: "Yes" },
                  { value: "not_sure", label: "Not sure — attorney review needed" },
                ]}
              />
              {supportOrder === "exists" ? (
                <div className="grid gap-4 rounded-lg bg-surface-muted p-4 sm:grid-cols-2">
                  <TextField
                    id="existingChildSupportOrderDetails.childNames"
                    label="Child name(s)"
                    required
                    registration={register("existingChildSupportOrderDetails.childNames")}
                    error={errors.existingChildSupportOrderDetails?.childNames?.message}
                  />
                  <TextField
                    id="existingChildSupportOrderDetails.proceedingType"
                    label="Type of proceeding"
                    required
                    registration={register("existingChildSupportOrderDetails.proceedingType")}
                    error={errors.existingChildSupportOrderDetails?.proceedingType?.message}
                  />
                  <TextField
                    id="existingChildSupportOrderDetails.courtAndAddress"
                    label="Court and address"
                    required
                    registration={register("existingChildSupportOrderDetails.courtAndAddress")}
                    error={errors.existingChildSupportOrderDetails?.courtAndAddress?.message}
                  />
                  <DateField
                    id="existingChildSupportOrderDetails.orderDate"
                    label="Date of order or judgment, if any"
                    registration={register("existingChildSupportOrderDetails.orderDate")}
                    error={errors.existingChildSupportOrderDetails?.orderDate?.message}
                  />
                  <TextField
                    id="existingChildSupportOrderDetails.amountAndPayer"
                    label="Amount of support and who pays"
                    required
                    registration={register("existingChildSupportOrderDetails.amountAndPayer")}
                    error={errors.existingChildSupportOrderDetails?.amountAndPayer?.message}
                  />
                </div>
              ) : null}
            </fieldset>
          ) : null}
        </>
      )}
    </div>
  );
}
