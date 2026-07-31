import { describe, expect, it } from "vitest";

import { cents } from "@/domain/rules/money";

import {
  LumpSumInputError,
  MAX_DISCOUNT_RATE_BPS,
  combineSettlementComponents,
  modelLumpSum,
  presentValueOfMonthlyPayments,
} from "../lumpSum";

describe("presentValueOfMonthlyPayments", () => {
  it("returns the undiscounted sum at a zero rate", () => {
    expect(presentValueOfMonthlyPayments(cents(100_000), 24, 0)).toBe(24 * 100_000);
  });

  it("returns zero for a zero-month term", () => {
    expect(presentValueOfMonthlyPayments(cents(100_000), 0, 500)).toBe(0);
  });

  it("returns zero for a zero payment", () => {
    expect(presentValueOfMonthlyPayments(cents(0), 60, 500)).toBe(0);
  });

  it("discounts below the undiscounted total at a positive rate", () => {
    const undiscounted = 100_000 * 60;
    const present = presentValueOfMonthlyPayments(cents(100_000), 60, 500);

    expect(present).toBeLessThan(undiscounted);
    expect(present).toBeGreaterThan(0);
  });

  it("matches the standard ordinary-annuity formula", () => {
    // $1,000/mo for 60 months at 5% annual => PV factor 52.99071...
    const present = presentValueOfMonthlyPayments(cents(100_000), 60, 500);
    const monthlyRate = 0.05 / 12;
    const expected = Math.round(100_000 * ((1 - Math.pow(1 + monthlyRate, -60)) / monthlyRate));

    expect(present).toBe(expected);
  });

  it("discounts more heavily as the rate rises", () => {
    const low = presentValueOfMonthlyPayments(cents(100_000), 120, 200);
    const high = presentValueOfMonthlyPayments(cents(100_000), 120, 800);

    expect(high).toBeLessThan(low);
  });

  it("always returns an integer number of cents", () => {
    for (const rate of [0, 137, 250, 333, 500, 999, 1_750]) {
      const value = presentValueOfMonthlyPayments(cents(123_457), 77, rate);
      expect(Number.isInteger(value), `rate ${rate}`).toBe(true);
    }
  });
});

describe("modelLumpSum validation", () => {
  const base = { monthlyAmountCents: cents(100_000), numberOfMonths: 60, annualDiscountRateBps: 500 };

  it("rejects a negative term", () => {
    expect(() => modelLumpSum({ ...base, numberOfMonths: -1 })).toThrow(LumpSumInputError);
  });

  it("rejects a fractional term", () => {
    expect(() => modelLumpSum({ ...base, numberOfMonths: 12.5 })).toThrow(LumpSumInputError);
  });

  it("rejects an implausibly long term", () => {
    expect(() => modelLumpSum({ ...base, numberOfMonths: 1_201 })).toThrow(LumpSumInputError);
  });

  it("rejects a negative payment", () => {
    expect(() => modelLumpSum({ ...base, monthlyAmountCents: cents(-1) })).toThrow(LumpSumInputError);
  });

  it("rejects a rate above the supported maximum", () => {
    expect(() => modelLumpSum({ ...base, annualDiscountRateBps: MAX_DISCOUNT_RATE_BPS + 1 })).toThrow(
      LumpSumInputError,
    );
  });

  it("rejects a negative rate", () => {
    expect(() => modelLumpSum({ ...base, annualDiscountRateBps: -1 })).toThrow(LumpSumInputError);
  });

  it("accepts a zero rate, which represents no discounting at all", () => {
    expect(() => modelLumpSum({ ...base, annualDiscountRateBps: 0 })).not.toThrow();
  });
});

describe("modelLumpSum output", () => {
  const model = modelLumpSum({
    monthlyAmountCents: cents(150_000),
    numberOfMonths: 72,
    annualDiscountRateBps: 400,
  });

  it("reports the selected rate the user chose", () => {
    expect(model.selected.annualDiscountRateBps).toBe(400);
  });

  it("reports the undiscounted total independently of the present value", () => {
    expect(model.selected.undiscountedTotalCents).toBe(150_000 * 72);
    expect(model.selected.presentValueCents).toBeLessThan(model.selected.undiscountedTotalCents);
  });

  it("reports the discount as the difference between the two", () => {
    expect(model.selected.discountAmountCents).toBe(
      model.selected.undiscountedTotalCents - model.selected.presentValueCents,
    );
  });

  it("returns a sensitivity range sorted ascending by rate", () => {
    const rates = model.range.map((scenario) => scenario.annualDiscountRateBps);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(rates.length).toBeGreaterThan(1);
  });

  it("includes the user's chosen rate in the range", () => {
    expect(model.range.map((scenario) => scenario.annualDiscountRateBps)).toContain(400);
  });

  it("does not duplicate the chosen rate when it matches a standard one", () => {
    const standard = modelLumpSum({
      monthlyAmountCents: cents(100_000),
      numberOfMonths: 60,
      annualDiscountRateBps: 500,
    });
    const occurrences = standard.range.filter((scenario) => scenario.annualDiscountRateBps === 500);

    expect(occurrences).toHaveLength(1);
  });

  it("shows present value falling monotonically as the rate rises", () => {
    const values = model.range.map((scenario) => scenario.presentValueCents);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });

  it("discloses that the discount rate is not set by Florida law", () => {
    expect(model.assumptions.join(" ")).toContain("not set by Florida law");
    expect(model.assumptions.join(" ")).toContain("61.075(10)(b)");
  });

  it("warns about modifiability and about tax treatment", () => {
    const warnings = model.warnings.join(" ");
    expect(warnings).toContain("modified");
    expect(warnings).toContain("Qualified Domestic Relations Order");
    expect(warnings.toLowerCase()).toContain("tax");
  });
});

describe("combineSettlementComponents", () => {
  it("adds the components when the same spouse owes both", () => {
    const combined = combineSettlementComponents({
      alimonyLumpSumCents: cents(5_000_000),
      equalizingPaymentCents: cents(2_500_000),
      sameDirection: true,
    });

    expect(combined.totalTransferCents).toBe(7_500_000);
    expect(combined.componentsOffset).toBe(false);
  });

  it("nets the components when they run in opposite directions", () => {
    const combined = combineSettlementComponents({
      alimonyLumpSumCents: cents(5_000_000),
      equalizingPaymentCents: cents(2_500_000),
      sameDirection: false,
    });

    expect(combined.totalTransferCents).toBe(2_500_000);
    expect(combined.componentsOffset).toBe(true);
  });

  it("never returns a negative transfer when the offset reverses direction", () => {
    const combined = combineSettlementComponents({
      alimonyLumpSumCents: cents(1_000_000),
      equalizingPaymentCents: cents(4_000_000),
      sameDirection: false,
    });

    expect(combined.totalTransferCents).toBe(3_000_000);
  });
});
