"use client";

import { useWatch } from "react-hook-form";

import type { ParentingPlanDetails } from "@/domain/intake";
import { Alert } from "@/components/ui";

import {
  DateField,
  CountField,
  RadioGroupField,
  TextareaField,
  TextField,
  YesNoField,
} from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

const PARENT_OPTIONS = [
  { value: "you", label: "You" },
  { value: "other_parent", label: "The other parent" },
  { value: "undecided", label: "Not decided yet" },
];

export function ParentingPlanDetailsFields({
  register,
  errors,
  control,
}: StepFieldsProps<ParentingPlanDetails>) {
  const schoolCalendarBasis = useWatch({ control, name: "schoolCalendarBasis" });
  const differentSchedule = useWatch({ control, name: "differentChildSchedule" });
  const transportationMode = useWatch({ control, name: "transportationMode" });
  const exchangeMode = useWatch({ control, name: "exchangeLocationMode" });
  const transportationCostsMode = useWatch({ control, name: "transportationCostsMode" });
  const childcareMode = useWatch({ control, name: "childcareMode" });

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="info" role="note" className="text-sm">
        These questions follow the remaining sections of Florida Form 12.995(a). Choose only terms the
        parties have actually agreed to or that you want clearly marked as a proposal.
      </Alert>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">Plan status and addresses</legend>
        <RadioGroupField
          id="planOrderType"
          legend="Is this intended as a final, temporary, or modified parenting plan?"
          required
          registration={register("planOrderType")}
          error={errors.planOrderType?.message}
          options={[
            { value: "final", label: "Final parenting plan" },
            { value: "temporary", label: "Temporary parenting plan" },
            { value: "modification", label: "Modification of a prior plan or order" },
          ]}
        />
        {(["petitioner", "respondent"] as const).map((party) => (
          <RadioGroupField
            key={party}
            id={`${party}AddressStatus`}
            legend={`${party === "petitioner" ? "Petitioner's" : "Respondent's"} address status`}
            required
            registration={register(`${party}AddressStatus`)}
            error={errors[`${party}AddressStatus`]?.message}
            options={[
              { value: "known", label: "Known and may appear on the draft" },
              { value: "unknown", label: "Unknown" },
              { value: "confidential", label: "Confidential — do not place it on the draft" },
            ]}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">Activities and information sharing</legend>
        <RadioGroupField
          id="extracurricularApproval"
          legend="Who may approve extracurricular activities?"
          required
          registration={register("extracurricularApproval")}
          error={errors.extracurricularApproval?.message}
          options={[
            { value: "either_parent", label: "Either parent" },
            { value: "mutual_agreement", label: "Both parents must agree" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        <RadioGroupField
          id="extracurricularTransportation"
          legend="Who transports the children to agreed activities?"
          required
          registration={register("extracurricularTransportation")}
          error={errors.extracurricularTransportation?.message}
          options={[
            { value: "parent_with_child", label: "The parent who has the child" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        <TextField
          id="extracurricularActivityCostPercentSelf"
          label="Your percentage of extracurricular activity costs"
          hint="Enter a number from 0 to 100. The other parent's share is calculated as the remainder."
          required
          registration={register("extracurricularActivityCostPercentSelf", { valueAsNumber: true })}
          error={errors.extracurricularActivityCostPercentSelf?.message}
        />
        <TextField
          id="extracurricularEquipmentCostPercentSelf"
          label="Your percentage of uniform and equipment costs"
          hint="Enter a number from 0 to 100. The other parent's share is calculated as the remainder."
          required
          registration={register("extracurricularEquipmentCostPercentSelf", { valueAsNumber: true })}
          error={errors.extracurricularEquipmentCostPercentSelf?.message}
        />
        <TextField
          id="extracurricularCosts"
          label="Other extracurricular-activity terms"
          registration={register("extracurricularCosts")}
          error={errors.extracurricularCosts?.message}
        />
        <TextareaField
          id="informationSharingOther"
          label="Any additional rules for sharing school, medical, or government records?"
          registration={register("informationSharingOther")}
          error={errors.informationSharingOther?.message}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">School calendar and schedule changes</legend>
        <RadioGroupField
          id="schoolCalendarBasis"
          legend="Which school calendar controls the schedule?"
          required
          registration={register("schoolCalendarBasis")}
          error={errors.schoolCalendarBasis?.message}
          options={[
            { value: "oldest_child", label: "Oldest child's calendar" },
            { value: "youngest_child", label: "Youngest child's calendar" },
            { value: "county", label: "A named county calendar" },
            { value: "school", label: "A named school calendar" },
          ]}
        />
        {schoolCalendarBasis === "county" || schoolCalendarBasis === "school" ? (
          <TextField
            id="schoolCalendarDetails"
            label={schoolCalendarBasis === "county" ? "County" : "School"}
            required
            registration={register("schoolCalendarDetails")}
            error={errors.schoolCalendarDetails?.message}
          />
        ) : null}
        <TextField
          id="scheduleChangeNotice"
          label="How much notice is required for a schedule change?"
          required
          registration={register("scheduleChangeNotice")}
          error={errors.scheduleChangeNotice?.message}
        />
        <YesNoField
          id="scheduleChangeRequesterPaysCosts"
          legend="Does the parent requesting a change pay added child-care or transportation costs?"
          required
          registration={register("scheduleChangeRequesterPaysCosts")}
          error={errors.scheduleChangeRequesterPaysCosts?.message}
        />
        <TextareaField
          id="scheduleChangeOther"
          label="Other schedule-change terms"
          registration={register("scheduleChangeOther")}
          error={errors.scheduleChangeOther?.message}
        />
        <DateField
          id="scheduleStartDate"
          label="Date the regular time-sharing schedule begins"
          required
          registration={register("scheduleStartDate")}
          error={errors.scheduleStartDate?.message}
        />
        <YesNoField
          id="differentChildSchedule"
          legend="Does any child have a different time-sharing schedule?"
          required
          registration={register("differentChildSchedule")}
          error={errors.differentChildSchedule?.message}
        />
        {differentSchedule === "yes" ? (
          <TextareaField
            id="differentChildScheduleDetails"
            label="Describe each different schedule and identify the child"
            required
            registration={register("differentChildScheduleDetails")}
            error={errors.differentChildScheduleDetails?.message}
          />
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">School breaks</legend>
        <RadioGroupField
          id="winterBreakMode"
          legend="How is winter break handled?"
          required
          registration={register("winterBreakMode")}
          error={errors.winterBreakMode?.message}
          options={[
            { value: "split", label: "Split into two portions" },
            { value: "alternating_entire_break", label: "Alternate the entire break" },
            { value: "other", label: "Other written arrangement" },
          ]}
        />
        <TextareaField
          id="winterBreakDetails"
          label="Exact winter-break dates, times, and rotation"
          required
          registration={register("winterBreakDetails")}
          error={errors.winterBreakDetails?.message}
        />
        <RadioGroupField
          id="springBreakMode"
          legend="How is spring break handled?"
          required
          registration={register("springBreakMode")}
          error={errors.springBreakMode?.message}
          options={[
            { value: "regular_schedule", label: "Follow the regular schedule" },
            { value: "alternating", label: "Alternate the entire break" },
            { value: "one_parent", label: "One parent every year" },
            { value: "even_split", label: "Split the break equally" },
            { value: "other", label: "Other written arrangement" },
          ]}
        />
        <RadioGroupField
          id="springBreakParent"
          legend="Parent named for spring-break terms, if applicable"
          registration={register("springBreakParent")}
          error={errors.springBreakParent?.message}
          options={PARENT_OPTIONS}
        />
        <TextareaField
          id="springBreakDetails"
          label="Exact spring-break dates, times, and rotation"
          required
          registration={register("springBreakDetails")}
          error={errors.springBreakDetails?.message}
        />
        <RadioGroupField
          id="summerBreakMode"
          legend="How is summer break handled?"
          required
          registration={register("summerBreakMode")}
          error={errors.summerBreakMode?.message}
          options={[
            { value: "regular_schedule", label: "Follow the regular schedule" },
            { value: "one_parent", label: "One parent has the entire break" },
            { value: "equal_split", label: "Divide the break equally" },
            { value: "other", label: "Other written arrangement" },
          ]}
        />
        <RadioGroupField
          id="summerBreakParent"
          legend="Parent named for summer-break terms, if applicable"
          registration={register("summerBreakParent")}
          error={errors.summerBreakParent?.message}
          options={PARENT_OPTIONS}
        />
        <TextareaField
          id="summerBreakDetails"
          label="Exact summer-break dates, times, and rotation"
          required
          registration={register("summerBreakDetails")}
          error={errors.summerBreakDetails?.message}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">Transportation, exchanges, and travel</legend>
        <RadioGroupField
          id="transportationMode"
          legend="Who provides routine transportation?"
          required
          registration={register("transportationMode")}
          error={errors.transportationMode?.message}
          options={[
            { value: "you", label: "You" },
            { value: "other_parent", label: "The other parent" },
            { value: "beginning_parent", label: "The parent beginning time-sharing" },
            { value: "ending_parent", label: "The parent ending time-sharing" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        {transportationMode === "other" ? (
          <TextareaField
            id="transportationDetails"
            label="Transportation arrangement"
            required
            registration={register("transportationDetails")}
            error={errors.transportationDetails?.message}
          />
        ) : null}
        <CountField
          id="lateExchangeMinutes"
          label="How many minutes late before the waiting parent may proceed with other plans?"
          required
          registration={register("lateExchangeMinutes", { valueAsNumber: true })}
          error={errors.lateExchangeMinutes?.message}
        />
        <RadioGroupField
          id="exchangeLocationMode"
          legend="Where do exchanges occur?"
          required
          registration={register("exchangeLocationMode")}
          error={errors.exchangeLocationMode?.message}
          options={[
            { value: "parents_homes", label: "At the parents' homes" },
            { value: "specific_location", label: "At a specific location" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        {exchangeMode !== "parents_homes" ? (
          <TextareaField
            id="exchangeLocationDetails"
            label="Exchange location and instructions"
            required
            registration={register("exchangeLocationDetails")}
            error={errors.exchangeLocationDetails?.message}
          />
        ) : null}
        <RadioGroupField
          id="transportationCostsMode"
          legend="How are transportation costs handled?"
          required
          registration={register("transportationCostsMode")}
          error={errors.transportationCostsMode?.message}
          options={[
            { value: "child_support_order", label: "Addressed in the child-support worksheet or order" },
            { value: "split", label: "Split between the parents" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        {transportationCostsMode !== "child_support_order" ? (
          <TextareaField
            id="transportationCostsDetails"
            label="Transportation-cost division"
            required
            registration={register("transportationCostsDetails")}
            error={errors.transportationCostsDetails?.message}
          />
        ) : null}
        <CountField
          id="domesticTravelNoticeDays"
          label="Days of notice before out-of-state travel"
          required
          registration={register("domesticTravelNoticeDays", { valueAsNumber: true })}
          error={errors.domesticTravelNoticeDays?.message}
        />
        <CountField
          id="internationalTravelNoticeDays"
          label="Days of notice before international travel"
          required
          registration={register("internationalTravelNoticeDays", { valueAsNumber: true })}
          error={errors.internationalTravelNoticeDays?.message}
        />
        <TextareaField
          id="internationalTravelSecurity"
          label="Any security or documentation required for international travel"
          registration={register("internationalTravelSecurity")}
          error={errors.internationalTravelSecurity?.message}
        />
        <TextareaField
          id="travelOther"
          label="Other travel terms"
          registration={register("travelOther")}
          error={errors.travelOther?.message}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-base font-semibold text-ink">Communication, child care, and disputes</legend>
        <RadioGroupField
          id="majorityDesignationParent"
          legend="Which parent is designated as the majority-residence parent only for laws requiring a designation?"
          required
          registration={register("majorityDesignationParent")}
          error={errors.majorityDesignationParent?.message}
          options={PARENT_OPTIONS}
        />
        <div className="flex flex-col gap-2">
          <p className="font-medium text-ink">How will the parents communicate?</p>
          {[
            ["in_person", "In person"],
            ["telephone", "Telephone"],
            ["letter", "Letter"],
            ["email", "Email"],
            ["other", "Other"],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-3">
              <input type="checkbox" value={value} {...register("parentCommunicationMethods")} />
              {label}
            </label>
          ))}
          {errors.parentCommunicationMethods?.message ? (
            <p role="alert" className="text-sm text-danger">{errors.parentCommunicationMethods.message}</p>
          ) : null}
        </div>
        <TextField
          id="parentCommunicationOther"
          label="Other parent-to-parent communication method"
          registration={register("parentCommunicationOther")}
          error={errors.parentCommunicationOther?.message}
        />
        <div className="flex flex-col gap-2">
          <p className="font-medium text-ink">How may the child communicate with the other parent?</p>
          {[
            ["telephone", "Telephone"],
            ["email", "Email"],
            ["video", "Video call"],
            ["other", "Other electronic communication"],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-3">
              <input type="checkbox" value={value} {...register("childCommunicationMethods")} />
              {label}
            </label>
          ))}
          {errors.childCommunicationMethods?.message ? (
            <p role="alert" className="text-sm text-danger">{errors.childCommunicationMethods.message}</p>
          ) : null}
        </div>
        <RadioGroupField
          id="childCommunicationMode"
          legend="When may the child communicate with the other parent?"
          required
          registration={register("childCommunicationMode")}
          error={errors.childCommunicationMode?.message}
          options={[
            { value: "anytime", label: "Any reasonable time" },
            { value: "daily", label: "Every day during stated hours" },
            { value: "specific_days", label: "Specific days and hours" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        <TextareaField
          id="childCommunicationDetails"
          label="Communication schedule and details"
          required
          registration={register("childCommunicationDetails")}
          error={errors.childCommunicationDetails?.message}
        />
        <TextareaField
          id="electronicCommunicationCosts"
          label="Who pays electronic-communication costs?"
          required
          registration={register("electronicCommunicationCosts")}
          error={errors.electronicCommunicationCosts?.message}
        />
        <RadioGroupField
          id="childcareMode"
          legend="How are child-care providers selected?"
          required
          registration={register("childcareMode")}
          error={errors.childcareMode?.message}
          options={[
            { value: "each_parent_selects", label: "Each parent selects appropriate care during their time" },
            { value: "mutual_agreement", label: "Both parents must agree" },
            { value: "right_of_first_refusal", label: "Offer the other parent care first" },
            { value: "other", label: "Other arrangement" },
          ]}
        />
        {childcareMode === "right_of_first_refusal" ? (
          <CountField
            id="rightOfFirstRefusalHours"
            label="Hours of planned child care that trigger the offer"
            required
            registration={register("rightOfFirstRefusalHours", { valueAsNumber: true })}
            error={errors.rightOfFirstRefusalHours?.message}
          />
        ) : null}
        <TextareaField
          id="childcareDetails"
          label="Other child-care details"
          registration={register("childcareDetails")}
          error={errors.childcareDetails?.message}
        />
        <TextareaField
          id="disputeResolution"
          label="How will parenting disputes be handled before court action?"
          required
          registration={register("disputeResolution")}
          error={errors.disputeResolution?.message}
        />
        <TextareaField
          id="otherProvisions"
          label="Other parenting-plan provisions"
          registration={register("otherProvisions")}
          error={errors.otherProvisions?.message}
        />
      </fieldset>
    </div>
  );
}
