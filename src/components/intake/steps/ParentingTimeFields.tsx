import type { ParentingTime } from "@/domain/intake";

import { CountField, RadioGroupField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

export function ParentingTimeFields({ register, errors }: StepFieldsProps<ParentingTime>) {
  return (
    <div className="flex flex-col gap-5">
      <CountField
        id="overnightsWithYouPerYear"
        label="Overnights per year with you"
        hint="A rough estimate is fine — for example, every-other-weekend is roughly 104 nights a year."
        required
        max={366}
        registration={register("overnightsWithYouPerYear")}
        error={errors.overnightsWithYouPerYear?.message}
      />
      <CountField
        id="overnightsWithOtherParentPerYear"
        label="Overnights per year with the other parent"
        required
        max={366}
        registration={register("overnightsWithOtherParentPerYear")}
        error={errors.overnightsWithOtherParentPerYear?.message}
      />
      <RadioGroupField
        id="scheduleStatus"
        legend="Is the parenting time schedule agreed upon?"
        required
        registration={register("scheduleStatus")}
        error={errors.scheduleStatus?.message}
        options={[
          { value: "agreed", label: "Yes, we agree on the schedule" },
          { value: "in_dispute", label: "No, this is in dispute" },
          { value: "not_yet_discussed", label: "We haven't discussed it yet" },
        ]}
      />
    </div>
  );
}
