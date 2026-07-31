import type { ParentingPlan } from "@/domain/intake";

import { TextareaField, RadioGroupField } from "../fields";
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

export function ParentingPlanFields({ register, errors }: StepFieldsProps<ParentingPlan>) {
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
      <TextareaField
        id="holidaySchedule"
        label="Holidays and school breaks"
        hint="Many plans alternate major holidays by even and odd years. Include birthdays and Mother's or Father's Day if you have discussed them."
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
