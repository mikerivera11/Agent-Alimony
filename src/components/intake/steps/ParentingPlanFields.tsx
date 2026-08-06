"use client";

import { useFieldArray, useWatch } from "react-hook-form";

import type { ParentingPlan } from "@/domain/intake";
import { Alert } from "@/components/ui";

import { CheckboxField, RadioGroupField, SelectField, TextareaField, TextField } from "../fields";
import { dangerLinkClasses, secondaryButtonClasses } from "../fields/inputStyles";
import type { StepFieldsProps } from "./StepFieldsProps";

/**
 * Parenting plan terms.
 *
 * Unlike every other step, almost nothing here is a fact to be looked up — a
 * time-sharing schedule is a decision. So the fields are free text with
 * examples rather than pick-lists that would quietly narrow what a person can
 * propose, and all of them may be left blank. "Undecided" is a real answer and
 * is offered explicitly, because a plan with an unconsidered term in it is
 * worse than a plan with a gap an attorney can see.
 */
const RESPONSIBILITY_OPTIONS = [
  { value: "shared", label: "Shared — we decide together" },
  { value: "you", label: "You decide" },
  { value: "other_parent", label: "The other parent decides" },
  { value: "undecided", label: "Not decided yet" },
];

const HOLIDAY_ROTATION_OPTIONS = [
  { value: "alternating", label: "Alternate every year" },
  { value: "you_every_year", label: "You every year" },
  { value: "other_parent_every_year", label: "The other parent every year" },
  { value: "regular_schedule", label: "Follow the regular schedule" },
  { value: "undecided", label: "Not decided yet" },
];

function generateHolidayId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `holiday-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ParentingPlanFields({ register, errors, control }: StepFieldsProps<ParentingPlan>) {
  const holidayScheduleMode = useWatch({ control, name: "holidayScheduleMode" });
  const holidaySchedules = useWatch({ control, name: "holidaySchedules" }) ?? [];
  const {
    fields: holidayFields,
    append: appendHoliday,
    remove: removeHoliday,
  } = useFieldArray({ control, name: "holidaySchedules", keyName: "fieldKey" });

  return (
    <div className="flex flex-col gap-5">
      <RadioGroupField
        id="planStatus"
        legend="Where does your parenting plan stand?"
        required
        registration={register("planStatus")}
        error={errors.planStatus?.message}
        options={[
          { value: "agreed", label: "We have agreed on a plan" },
          { value: "proposed", label: "This is what I would propose" },
          { value: "in_dispute", label: "We disagree about the plan" },
        ]}
      />

      <RadioGroupField
        id="schoolDesignationParent"
        legend="Whose address will be used for school registration?"
        hint="Florida parenting plans designate one parent's address for school-boundary purposes. It does not decide time-sharing."
        required
        registration={register("schoolDesignationParent")}
        error={errors.schoolDesignationParent?.message}
        options={[
          { value: "you", label: "Yours" },
          { value: "other_parent", label: "The other parent's" },
          { value: "undecided", label: "Not decided yet" },
        ]}
      />

      <RadioGroupField
        id="decisionMakingEducation"
        legend="Who makes decisions about education?"
        required
        registration={register("decisionMakingEducation")}
        error={errors.decisionMakingEducation?.message}
        options={RESPONSIBILITY_OPTIONS}
      />
      <RadioGroupField
        id="decisionMakingHealthcare"
        legend="Who makes decisions about health care?"
        required
        registration={register("decisionMakingHealthcare")}
        error={errors.decisionMakingHealthcare?.message}
        options={RESPONSIBILITY_OPTIONS}
      />
      <RadioGroupField
        id="decisionMakingReligion"
        legend="Who makes decisions about religious upbringing?"
        required
        registration={register("decisionMakingReligion")}
        error={errors.decisionMakingReligion?.message}
        options={RESPONSIBILITY_OPTIONS}
      />

      <TextareaField
        id="weekdaySchedule"
        label="Weekday schedule"
        hint="For example: the children are with me Monday and Tuesday nights, and with their other parent Wednesday and Thursday nights."
        registration={register("weekdaySchedule")}
        error={errors.weekdaySchedule?.message}
      />
      <TextareaField
        id="weekendSchedule"
        label="Weekend schedule"
        hint="For example: alternating weekends from Friday after school to Monday morning."
        registration={register("weekendSchedule")}
        error={errors.weekendSchedule?.message}
      />

      <RadioGroupField
        id="holidayScheduleMode"
        legend="How will holidays be handled?"
        hint="Florida's standard parenting-plan form allows the regular schedule, agreement as holidays arise, or a specific written schedule."
        required
        registration={register("holidayScheduleMode")}
        error={errors.holidayScheduleMode?.message}
        options={[
          { value: "specific", label: "Use a specific holiday schedule" },
          { value: "regular_schedule", label: "Follow the regular time-sharing schedule" },
          { value: "as_agreed", label: "Decide holidays by agreement" },
        ]}
      />

      {holidayScheduleMode === "specific" ? (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2 p-4" aria-labelledby="holiday-builder-heading">
          <div className="flex flex-col gap-2">
            <h3 id="holiday-builder-heading" className="text-lg font-semibold text-ink">
              Holiday schedule builder
            </h3>
            <Alert variant="info" role="status" className="text-sm">
              <p>
                These are <strong>proposed defaults, not Florida legal defaults</strong>. Thanksgiving,
                Christmas, and New Year&rsquo;s Day start as alternating-year holidays. Christmas is opposite
                Thanksgiving so one parent does not receive both in the same year. Review every assignment and
                add exact beginning and ending times.
              </p>
            </Alert>
          </div>

          {holidayFields.map((field, index) => {
            const rotation = holidaySchedules[index]?.rotation;
            const oddParent = holidaySchedules[index]?.oddYearParent;
            const evenParent = oddParent === "you" ? "the other parent" : oddParent === "other_parent" ? "you" : "not decided";
            const holidayErrors = errors.holidaySchedules?.[index];
            return (
              <fieldset key={field.fieldKey} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
                <legend className="px-1 text-base font-semibold text-ink">
                  {holidaySchedules[index]?.name || `Holiday ${index + 1}`}
                </legend>
                <input type="hidden" {...register(`holidaySchedules.${index}.id`)} />
                <TextField
                  id={`holiday-${index}-name`}
                  label="Holiday or special day"
                  required
                  registration={register(`holidaySchedules.${index}.name`)}
                  error={holidayErrors?.name?.message}
                />
                <SelectField
                  id={`holiday-${index}-rotation`}
                  label="Who has the children?"
                  required
                  options={HOLIDAY_ROTATION_OPTIONS}
                  registration={register(`holidaySchedules.${index}.rotation`)}
                  error={holidayErrors?.rotation?.message}
                />
                {rotation === "alternating" ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SelectField
                      id={`holiday-${index}-odd-year-parent`}
                      label="Odd-numbered years"
                      required
                      options={[
                        { value: "you", label: "You" },
                        { value: "other_parent", label: "The other parent" },
                      ]}
                      registration={register(`holidaySchedules.${index}.oddYearParent`)}
                      error={holidayErrors?.oddYearParent?.message}
                    />
                    <div className="rounded-lg border border-border bg-surface-2 p-3">
                      <p className="text-sm font-medium text-ink">Even-numbered years</p>
                      <p className="mt-1 text-sm text-ink-muted capitalize">{evenParent}</p>
                    </div>
                  </div>
                ) : null}
                <TextField
                  id={`holiday-${index}-begin-end-time`}
                  label="Beginning and ending time"
                  hint="Be exact. Example: Wednesday at 6:00 p.m. until Sunday at 6:00 p.m."
                  placeholder="Not decided yet"
                  registration={register(`holidaySchedules.${index}.beginEndTime`)}
                  error={holidayErrors?.beginEndTime?.message}
                />
                <TextareaField
                  id={`holiday-${index}-notes`}
                  label="Exchange or other details"
                  registration={register(`holidaySchedules.${index}.notes`)}
                  error={holidayErrors?.notes?.message}
                />
                <button type="button" onClick={() => removeHoliday(index)} className={`${dangerLinkClasses} self-start`}>
                  Remove {holidaySchedules[index]?.name || "holiday"}
                </button>
              </fieldset>
            );
          })}

          <button
            type="button"
            onClick={() =>
              appendHoliday({
                id: generateHolidayId(),
                name: "",
                rotation: "undecided",
                oddYearParent: undefined,
                beginEndTime: "",
                notes: "",
              })
            }
            className={`${secondaryButtonClasses} self-start`}
          >
            + Add another holiday or special day
          </button>
          {errors.holidaySchedules?.message ? (
            <p role="alert" className="text-sm font-medium text-danger-solid">
              {errors.holidaySchedules.message}
            </p>
          ) : null}

          <CheckboxField
            id="holidayScheduleOverridesRegular"
            label="The holiday schedule takes priority over the regular weekday, weekend, and summer schedules"
            hint="This matches the priority rule printed in the specific-holiday section of Form 12.995(a)."
            registration={register("holidayScheduleOverridesRegular")}
            error={errors.holidayScheduleOverridesRegular?.message}
          />
          <CheckboxField
            id="threeWeekendAdjustment"
            label="Correct the next weekend if the holiday schedule would give one parent three weekends in a row"
            hint="The form offers this as an optional way to return to the alternating-weekend pattern."
            registration={register("threeWeekendAdjustment")}
            error={errors.threeWeekendAdjustment?.message}
          />
          <CheckboxField
            id="unspecifiedHolidayFollowsAdjacentWeekend"
            label="An unspecified holiday or non-school day goes with the parent who has the adjacent weekend"
            registration={register("unspecifiedHolidayFollowsAdjacentWeekend")}
            error={errors.unspecifiedHolidayFollowsAdjacentWeekend?.message}
          />
        </section>
      ) : null}

      <TextareaField
        id="holidaySchedule"
        label="Winter break, spring break, and other schedule notes"
        hint="Include how school breaks are divided and any term not captured by the holiday rows above."
        registration={register("holidaySchedule")}
        error={errors.holidaySchedule?.message}
      />
      <TextareaField
        id="summerSchedule"
        label="Summer schedule"
        registration={register("summerSchedule")}
        error={errors.summerSchedule?.message}
      />
      <TextareaField
        id="exchangeArrangements"
        label="Exchanges — where and how the children move between homes"
        hint="Include who does the driving, and where the exchange happens."
        registration={register("exchangeArrangements")}
        error={errors.exchangeArrangements?.message}
      />
      <TextareaField
        id="communicationBetweenChildAndParent"
        label="How your child stays in touch with the other parent"
        hint="For example: a phone or video call at an agreed time on days the child is not with that parent."
        registration={register("communicationBetweenChildAndParent")}
        error={errors.communicationBetweenChildAndParent?.message}
      />

      <RadioGroupField
        id="relocationAnticipated"
        legend="Does either parent expect to move more than 50 miles away?"
        hint="Florida treats this as a separate legal process with its own requirements, so it is worth flagging early."
        required
        registration={register("relocationAnticipated")}
        error={errors.relocationAnticipated?.message}
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
      />
    </div>
  );
}
