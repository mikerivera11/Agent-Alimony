import { describe, expect, it } from "vitest";

import { cents } from "@/domain/rules/money";

import {
  HomeEquityInputError,
  MAX_PROJECTION_YEARS,
  calculateHomeEquity,
  type HomeEquityInput,
} from "../homeEquity";

const BASE: HomeEquityInput = {
  marketValueCents: cents(500_000_00),
  mortgageBalanceCents: cents(300_000_00),
  annualAppreciationBps: 300,
  growthBasis: "propertyValue",
  projectionYears: 5,
};

function input(overrides: Partial<HomeEquityInput> = {}): HomeEquityInput {
  return { ...BASE, ...overrides };
}

describe("calculateHomeEquity — current position", () => {
  it("computes equity as value minus mortgage", () => {
    const result = calculateHomeEquity(input());
    expect(result.current.equityCents).toBe(200_000_00);
    expect(result.current.isUnderwater).toBe(false);
    expect(result.current.negativeEquityCents).toBe(0);
  });

  it("reports negative equity rather than a negative asset when underwater", () => {
    // A house worth less than its mortgage is a liability. Reporting equity as
    // -$50,000 would let it silently subtract from the estate elsewhere.
    const result = calculateHomeEquity(
      input({ marketValueCents: cents(250_000_00), mortgageBalanceCents: cents(300_000_00) }),
    );

    expect(result.current.equityCents).toBe(0);
    expect(result.current.isUnderwater).toBe(true);
    expect(result.current.negativeEquityCents).toBe(50_000_00);
    expect(result.assumptions.join(" ")).toContain("marital liability");
  });

  it("takes selling costs off the sale price, not off equity", () => {
    // 6% of the $500k price is $30k, so $200k equity nets $170k. Discounting
    // the $200k equity by 6% instead would wrongly give $188k.
    const result = calculateHomeEquity(input({ costOfSaleBps: 600, projectionYears: 0 }));

    expect(result.current.equityCents).toBe(200_000_00);
    expect(result.current.netOfSaleCostsCents).toBe(170_000_00);
  });

  it("never reports negative net proceeds", () => {
    const result = calculateHomeEquity(
      input({ marketValueCents: cents(310_000_00), costOfSaleBps: 1_000, projectionYears: 0 }),
    );
    expect(result.current.netOfSaleCostsCents).toBe(0);
  });

  it("handles a fully paid-off home", () => {
    const result = calculateHomeEquity(input({ mortgageBalanceCents: cents(0), projectionYears: 0 }));
    expect(result.current.equityCents).toBe(500_000_00);
  });
});

describe("calculateHomeEquity — projection", () => {
  it("returns no projection when no years are requested", () => {
    const result = calculateHomeEquity(input({ projectionYears: 0 }));
    expect(result.projection).toEqual([]);
    expect(result.current.equityCents).toBe(200_000_00);
  });

  it("grows the property value and lets leverage amplify equity", () => {
    // $500k at 3% for 5 years is $579,637.04. Minus the flat $300k mortgage
    // leaves $279,637.04 — a 39.8% equity gain from a 15.9% value gain.
    const result = calculateHomeEquity(input({ annualAppreciationBps: 300, projectionYears: 5 }));
    const scenario = result.projection.find((s) => s.isUserSelected);

    expect(scenario?.finalYear.marketValueCents).toBe(579_637_04);
    expect(scenario?.finalYear.equityCents).toBe(279_637_04);
    expect(scenario?.finalYear.equityChangeFromTodayCents).toBe(79_637_04);
  });

  it("grows equity directly when that basis is chosen", () => {
    // $200k equity at 3% for 5 years is $231,854.81, and the reported market
    // value must stay consistent: equity + the unchanged $300k mortgage.
    const result = calculateHomeEquity(input({ growthBasis: "equity", annualAppreciationBps: 300 }));
    const scenario = result.projection.find((s) => s.isUserSelected);

    expect(scenario?.finalYear.equityCents).toBe(231_854_81);
    expect(scenario?.finalYear.marketValueCents).toBe(531_854_81);
  });

  it("starts every schedule at today's position", () => {
    const result = calculateHomeEquity(input());
    for (const scenario of result.projection) {
      expect(scenario.schedule[0].year).toBe(0);
      expect(scenario.schedule[0].equityCents).toBe(result.current.equityCents);
      expect(scenario.schedule[0].equityChangeFromTodayCents).toBe(0);
    }
  });

  it("always includes comparison rates alongside the user's own", () => {
    // A single projected number reads as a prediction. The range makes the
    // sensitivity to an unlegislated assumption visible.
    const result = calculateHomeEquity(input({ annualAppreciationBps: 700 }));
    const rates = result.projection.map((s) => s.annualAppreciationBps);

    expect(rates).toEqual([0, 200, 300, 500, 700]);
    expect(result.projection.filter((s) => s.isUserSelected)).toHaveLength(1);
  });

  it("does not duplicate a rate the user picked that matches a comparison rate", () => {
    const result = calculateHomeEquity(input({ annualAppreciationBps: 300 }));
    expect(result.projection.map((s) => s.annualAppreciationBps)).toEqual([0, 200, 300, 500]);
  });

  it("holds equity flat at a zero rate", () => {
    const flat = calculateHomeEquity(input()).projection.find((s) => s.annualAppreciationBps === 0);
    expect(flat?.finalYear.equityCents).toBe(200_000_00);
    expect(flat?.finalYear.equityChangeFromTodayCents).toBe(0);
  });

  it("models a declining market", () => {
    const result = calculateHomeEquity(input({ annualAppreciationBps: -500, projectionYears: 3 }));
    const scenario = result.projection.find((s) => s.isUserSelected);

    // $500k * 0.95^3 = $428,687.50, minus $300k = $128,687.50.
    expect(scenario?.finalYear.equityCents).toBe(128_687_50);
    expect(scenario?.finalYear.equityChangeFromTodayCents).toBe(-71_312_50);
  });

  it("reduces the mortgage by the yearly principal paydown", () => {
    const result = calculateHomeEquity(
      input({ annualAppreciationBps: 0, annualPrincipalPaydownCents: cents(6_000_00), projectionYears: 5 }),
    );
    const scenario = result.projection.find((s) => s.isUserSelected);

    expect(scenario?.finalYear.mortgageBalanceCents).toBe(270_000_00);
    expect(scenario?.finalYear.equityCents).toBe(230_000_00);
  });

  it("never drives the mortgage below zero", () => {
    const result = calculateHomeEquity(
      input({
        mortgageBalanceCents: cents(10_000_00),
        annualPrincipalPaydownCents: cents(6_000_00),
        annualAppreciationBps: 0,
        projectionYears: 5,
      }),
    );
    const scenario = result.projection.find((s) => s.isUserSelected);

    expect(scenario?.finalYear.mortgageBalanceCents).toBe(0);
    expect(scenario?.finalYear.equityCents).toBe(500_000_00);
  });

  it("compounds from the original value so later years do not accumulate rounding drift", () => {
    const result = calculateHomeEquity(input({ annualAppreciationBps: 333, projectionYears: 20 }));
    const scenario = result.projection.find((s) => s.isUserSelected);
    const expected = Math.round(500_000_00 * 1.0333 ** 20);

    expect(scenario?.finalYear.marketValueCents).toBe(expected);
  });

  it("produces whole-cent integers at every year", () => {
    const result = calculateHomeEquity(input({ annualAppreciationBps: 337, projectionYears: 10 }));
    for (const scenario of result.projection) {
      for (const year of scenario.schedule) {
        expect(Number.isInteger(year.equityCents)).toBe(true);
        expect(Number.isInteger(year.marketValueCents)).toBe(true);
      }
    }
  });
});

describe("calculateHomeEquity — disclosure and validation", () => {
  it("always states that projections are not what a court divides", () => {
    const assumptions = calculateHomeEquity(input()).assumptions.join(" ");
    expect(assumptions).toContain("§61.075(7)");
    expect(assumptions).toContain("planning scenario");
    expect(assumptions).toContain("No statute supplies an appreciation rate");
  });

  it("discloses that a flat mortgage understates future equity", () => {
    expect(calculateHomeEquity(input()).assumptions.join(" ")).toContain("understates future equity");
  });

  it("warns that growing equity directly is the less conventional model", () => {
    const assumptions = calculateHomeEquity(input({ growthBasis: "equity" })).assumptions.join(" ");
    expect(assumptions).toContain("more conventional");
  });

  it("is pure — the same input yields the same output", () => {
    expect(calculateHomeEquity(input())).toEqual(calculateHomeEquity(input()));
  });

  it.each([
    ["a negative market value", { marketValueCents: cents(-1) }],
    ["a negative mortgage", { mortgageBalanceCents: cents(-1) }],
    ["fractional years", { projectionYears: 2.5 }],
    ["negative years", { projectionYears: -1 }],
    ["too many years", { projectionYears: MAX_PROJECTION_YEARS + 1 }],
    ["an implausible growth rate", { annualAppreciationBps: 5_000 }],
    ["an implausible decline", { annualAppreciationBps: -5_000 }],
    ["selling costs over 100%", { costOfSaleBps: 10_001 }],
    ["a negative paydown", { annualPrincipalPaydownCents: cents(-1) }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => calculateHomeEquity(input(overrides as Partial<HomeEquityInput>))).toThrow(
      HomeEquityInputError,
    );
  });
});
