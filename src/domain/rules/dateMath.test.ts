import { describe, expect, it } from "vitest";

import { daysBetween, isValidIsoDate, wholeMonthsBetween } from "./dateMath";

describe("isValidIsoDate", () => {
  it("accepts valid ISO dates", () => {
    expect(isValidIsoDate("2020-01-15")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isValidIsoDate("2020-13-01")).toBe(false);
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isValidIsoDate("2020-02-30")).toBe(false);
  });
});

describe("daysBetween", () => {
  it("computes whole days", () => {
    expect(daysBetween("2020-01-01", "2020-01-11")).toBe(10);
  });
});

describe("wholeMonthsBetween", () => {
  it("computes exact whole months for aligned days", () => {
    expect(wholeMonthsBetween("2010-07-01", "2023-07-01")).toBe(156); // 13 years
  });

  it("floors a trailing partial month", () => {
    expect(wholeMonthsBetween("2010-01-15", "2020-01-14")).toBe(119);
  });

  it("never returns negative months", () => {
    expect(wholeMonthsBetween("2020-01-01", "2019-01-01")).toBe(0);
  });
});
