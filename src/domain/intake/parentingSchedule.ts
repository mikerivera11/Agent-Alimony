import type { HolidayScheduleItem } from "./schema";

export function parentingPlanParentLabel(value: "you" | "other_parent" | undefined): string {
  return value === "you" ? "You" : value === "other_parent" ? "The other parent" : "Not decided yet";
}

/** Human-readable assignment shared by review, worksheets, and package facts. */
export function describeHolidayRotation(holiday: HolidayScheduleItem): string {
  switch (holiday.rotation) {
    case "alternating": {
      const odd = parentingPlanParentLabel(holiday.oddYearParent);
      const even =
        holiday.oddYearParent === "you"
          ? "The other parent"
          : holiday.oddYearParent === "other_parent"
            ? "You"
            : "Not decided yet";
      return `Odd-numbered years: ${odd}. Even-numbered years: ${even}.`;
    }
    case "you_every_year":
      return "You every year.";
    case "other_parent_every_year":
      return "The other parent every year.";
    case "regular_schedule":
      return "The regular time-sharing schedule applies.";
    default:
      return "Not decided yet";
  }
}
