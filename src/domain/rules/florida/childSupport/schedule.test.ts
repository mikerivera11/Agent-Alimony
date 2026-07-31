import { describe, expect, it } from "vitest";

import { cents } from "../../money";
import {
  FLORIDA_CHILD_SUPPORT_SCHEDULE,
  lookupScheduleAmount,
  SCHEDULE_MAX_COMBINED_NET_INCOME_CENTS,
  SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS,
} from "./schedule";

describe("FLORIDA_CHILD_SUPPORT_SCHEDULE fixture", () => {
  it("has 185 rows spanning $800.00 to $10,000.00 in $50 increments", () => {
    expect(FLORIDA_CHILD_SUPPORT_SCHEDULE.schedule).toHaveLength(185);
    expect(SCHEDULE_MIN_COMBINED_NET_INCOME_CENTS).toBe(80_000);
    expect(SCHEDULE_MAX_COMBINED_NET_INCOME_CENTS).toBe(1_000_000);
  });

  it("has six above-schedule percentages", () => {
    expect(FLORIDA_CHILD_SUPPORT_SCHEDULE.aboveSchedulePercentBasisPointsByChildren).toHaveLength(6);
  });
});

describe("lookupScheduleAmount", () => {
  it("returns the exact row for an exact $50 multiple", () => {
    const result = lookupScheduleAmount(cents(80_000), 1);
    expect(result.rowCombinedNetIncomeCents).toBe(80_000);
    expect(result.normalizedToTableRow).toBe(false);
    expect(result.basicMonthlyNeedCents).toBe(19_000);
  });

  it("normalizes an intermediate income down to the bracket floor row, never interpolating", () => {
    // $824.99 falls inside the $800.00 bracket, not the $850.00 row.
    const result = lookupScheduleAmount(cents(82_499), 1);
    expect(result.rowCombinedNetIncomeCents).toBe(80_000);
    expect(result.normalizedToTableRow).toBe(true);
    expect(result.basicMonthlyNeedCents).toBe(19_000);
  });

  it("uses the $850 row once income reaches exactly $850.00", () => {
    const result = lookupScheduleAmount(cents(85_000), 1);
    expect(result.rowCombinedNetIncomeCents).toBe(85_000);
    expect(result.basicMonthlyNeedCents).toBe(20_200);
  });

  it("returns the top row unmodified at exactly $10,000.00", () => {
    const result = lookupScheduleAmount(cents(1_000_000), 1);
    expect(result.wasAboveSchedule).toBe(false);
    expect(result.basicMonthlyNeedCents).toBe(143_700);
  });

  it("computes the above-schedule percentage formula beyond $10,000.00", () => {
    // $10,500.00 combined net income, 1 child: 5.00% of the $500 overage.
    const result = lookupScheduleAmount(cents(1_050_000), 1);
    expect(result.wasAboveSchedule).toBe(true);
    expect(result.basicMonthlyNeedCents).toBe(143_700 + 2_500);
  });

  it("throws for incomes below the schedule minimum (callers must gate this branch)", () => {
    expect(() => lookupScheduleAmount(cents(79_999), 1)).toThrow(RangeError);
  });

  it("throws for an out-of-range number of children", () => {
    expect(() => lookupScheduleAmount(cents(100_000), 0)).toThrow(RangeError);
    expect(() => lookupScheduleAmount(cents(100_000), 7)).toThrow(RangeError);
  });

  it("supports all six child-count columns", () => {
    for (let n = 1; n <= 6; n += 1) {
      const result = lookupScheduleAmount(cents(200_000), n);
      expect(result.basicMonthlyNeedCents).toBeGreaterThan(0);
    }
  });
});
