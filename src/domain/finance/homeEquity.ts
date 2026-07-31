/**
 * Home equity: current position and projected growth.
 *
 * This module lives OUTSIDE `src/domain/rules/` on purpose, for the same
 * reason `lumpSum.ts` does. Current equity is arithmetic. A *projection* is
 * not law.
 *
 * Florida classifies and values the marital estate as of the §61.075(7)
 * cut-off date — the earliest of a valid separation agreement date, a date
 * set by that agreement, or the date the petition was filed. Appreciation
 * after that date is not what a court distributes, and no statute supplies an
 * appreciation rate. So a projected figure here is a planning assumption the
 * user supplied, and the caller must present it as a scenario, never as an
 * addition to the marital estate. `calculateHomeEquity` enforces the split by
 * returning `current` and `projection` as separate shapes.
 *
 * Two design consequences, mirroring the lump-sum module:
 *
 *  1. The growth rate is a required, explicit input with no default. A default
 *     would read as a legal or official standard, and none exists.
 *  2. Projections are returned across a RANGE of rates, so the sensitivity of
 *     the answer to an unlegislated assumption is visible rather than buried
 *     in a single confident-looking number.
 */

import { cents, clampToZero, roundHalfUp, subtractCents, type Cents } from "@/domain/rules/money";

/** Rates are integer basis points: 350 == 3.50% per year. */
export type BasisPoints = number;

export const HOME_EQUITY_MODEL_VERSION = "2026-07-31";

/** Sanity bounds on user-supplied growth. Wide enough for a real market, narrow enough to catch a typo. */
export const MIN_APPRECIATION_BPS = -2_000; // -20%/yr
export const MAX_APPRECIATION_BPS = 2_000; // +20%/yr

export const MAX_PROJECTION_YEARS = 30;

/**
 * Rates the projection is always run at, alongside whatever the user chose, so
 * a single estimate never stands alone. 0% is included deliberately: "the
 * house does not appreciate" is a legitimate scenario, not a pessimistic one.
 */
export const COMPARISON_APPRECIATION_BPS: readonly BasisPoints[] = [0, 200, 300, 500];

/**
 * What the growth rate is applied to.
 *
 * - `propertyValue` — the home's market value grows at the rate, and equity is
 *   recomputed against the mortgage each year. This is how real estate
 *   actually behaves, and because the mortgage is a fixed subtrahend, equity
 *   grows *faster* than the rate (leverage).
 * - `equity` — the equity figure itself grows at the rate. Simpler and
 *   sometimes what a person means by "my equity goes up ~5% a year", but it
 *   implicitly assumes the mortgage shrinks in step with the growth.
 */
export const HOME_EQUITY_GROWTH_BASES = ["propertyValue", "equity"] as const;
export type HomeEquityGrowthBasis = (typeof HOME_EQUITY_GROWTH_BASES)[number];

export interface HomeEquityInput {
  /** Fair market value today. */
  readonly marketValueCents: Cents;
  /** Mortgage payoff balance today. Entered positive. */
  readonly mortgageBalanceCents: Cents;
  /**
   * Optional selling costs as basis points of the projected sale price
   * (agent commission, doc stamps, title). Applied only to the
   * `netOfSaleCostsCents` figure, never to the equity figure itself.
   */
  readonly costOfSaleBps?: BasisPoints;
  /**
   * Optional principal paid down per year by scheduled mortgage payments.
   * Omitted means the balance is held flat, which understates future equity —
   * that is the conservative direction and is disclosed in `assumptions`.
   */
  readonly annualPrincipalPaydownCents?: Cents;
  /** The user's own growth estimate. Required; there is no default. */
  readonly annualAppreciationBps: BasisPoints;
  /** What the rate applies to. */
  readonly growthBasis: HomeEquityGrowthBasis;
  /** Whole years to project. 0 is valid and yields the current position only. */
  readonly projectionYears: number;
}

export interface HomeEquityPosition {
  readonly marketValueCents: Cents;
  readonly mortgageBalanceCents: Cents;
  /** Value minus mortgage, floored at zero. Negative equity is reported via `isUnderwater`. */
  readonly equityCents: Cents;
  /** Equity after estimated selling costs. Equals `equityCents` when no cost was given. */
  readonly netOfSaleCostsCents: Cents;
  /** True when the mortgage exceeds the value. */
  readonly isUnderwater: boolean;
  /** Shortfall when underwater, else zero. */
  readonly negativeEquityCents: Cents;
}

export interface HomeEquityYear extends HomeEquityPosition {
  /** Years from today. Year 0 is the current position. */
  readonly year: number;
  /** Growth in equity over the current position. Can be negative. */
  readonly equityChangeFromTodayCents: Cents;
}

export interface HomeEquityScenario {
  readonly annualAppreciationBps: BasisPoints;
  /** Whether this is the rate the user actually entered. */
  readonly isUserSelected: boolean;
  readonly schedule: readonly HomeEquityYear[];
  /** The final year of the schedule, for convenience. */
  readonly finalYear: HomeEquityYear;
}

export interface HomeEquityResult {
  readonly modelVersion: string;
  readonly growthBasis: HomeEquityGrowthBasis;
  readonly projectionYears: number;
  /** Today's position. This is the only figure safe to treat as an asset value. */
  readonly current: HomeEquityPosition;
  /**
   * Projected positions, at the user's rate and the comparison rates, sorted
   * ascending by rate. Empty when `projectionYears` is 0.
   */
  readonly projection: readonly HomeEquityScenario[];
  /** Plain-language statements of everything this model assumed. */
  readonly assumptions: readonly string[];
}

export class HomeEquityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HomeEquityInputError";
  }
}

function assertValid(input: HomeEquityInput): void {
  if (!Number.isFinite(input.marketValueCents) || input.marketValueCents < 0) {
    throw new HomeEquityInputError("Market value must be zero or more.");
  }
  if (!Number.isFinite(input.mortgageBalanceCents) || input.mortgageBalanceCents < 0) {
    throw new HomeEquityInputError("Mortgage balance must be zero or more (enter it as a positive number).");
  }
  if (!Number.isInteger(input.projectionYears) || input.projectionYears < 0) {
    throw new HomeEquityInputError("Projection years must be a whole number of years, zero or more.");
  }
  if (input.projectionYears > MAX_PROJECTION_YEARS) {
    throw new HomeEquityInputError(`Projections are limited to ${MAX_PROJECTION_YEARS} years.`);
  }
  if (!Number.isFinite(input.annualAppreciationBps)) {
    throw new HomeEquityInputError("Enter an estimated growth rate.");
  }
  if (
    input.annualAppreciationBps < MIN_APPRECIATION_BPS ||
    input.annualAppreciationBps > MAX_APPRECIATION_BPS
  ) {
    throw new HomeEquityInputError(
      `Growth rate must be between ${MIN_APPRECIATION_BPS / 100}% and ${MAX_APPRECIATION_BPS / 100}% per year.`,
    );
  }
  if (input.costOfSaleBps !== undefined && (input.costOfSaleBps < 0 || input.costOfSaleBps > 10_000)) {
    throw new HomeEquityInputError("Selling costs must be between 0% and 100% of the sale price.");
  }
  if (
    input.annualPrincipalPaydownCents !== undefined &&
    (!Number.isFinite(input.annualPrincipalPaydownCents) || input.annualPrincipalPaydownCents < 0)
  ) {
    throw new HomeEquityInputError("Yearly principal paydown must be zero or more.");
  }
}

function buildPosition(
  marketValueCents: number,
  mortgageBalanceCents: number,
  costOfSaleBps: number | undefined,
): HomeEquityPosition {
  const value = cents(roundHalfUp(marketValueCents));
  const mortgage = cents(roundHalfUp(mortgageBalanceCents));
  const rawEquity = subtractCents(value, mortgage);
  const equity = clampToZero(rawEquity);

  // Selling costs come off the sale price, not off equity, which is why this
  // is computed from `value` rather than by discounting `equity`.
  const sellingCosts = costOfSaleBps ? cents(roundHalfUp((value * costOfSaleBps) / 10_000)) : cents(0);

  return {
    marketValueCents: value,
    mortgageBalanceCents: mortgage,
    equityCents: equity,
    netOfSaleCostsCents: clampToZero(cents(rawEquity - sellingCosts)),
    isUnderwater: rawEquity < 0,
    negativeEquityCents: rawEquity < 0 ? cents(-rawEquity) : cents(0),
  };
}

function buildSchedule(
  input: HomeEquityInput,
  annualAppreciationBps: BasisPoints,
  current: HomeEquityPosition,
): readonly HomeEquityYear[] {
  const rate = annualAppreciationBps / 10_000;
  const schedule: HomeEquityYear[] = [
    { ...current, year: 0, equityChangeFromTodayCents: cents(0) },
  ];

  for (let year = 1; year <= input.projectionYears; year += 1) {
    // Compounded from the ORIGINAL value each year rather than iteratively
    // from the previous rounded year, so accumulated rounding error cannot
    // drift the later years.
    const growthFactor = (1 + rate) ** year;

    const paidDown = (input.annualPrincipalPaydownCents ?? 0) * year;
    const mortgage = Math.max(0, input.mortgageBalanceCents - paidDown);

    let position: HomeEquityPosition;
    if (input.growthBasis === "propertyValue") {
      position = buildPosition(input.marketValueCents * growthFactor, mortgage, input.costOfSaleBps);
    } else {
      // Growing equity directly: the value is back-solved so the reported
      // market value stays consistent with the equity and mortgage shown.
      const projectedEquity = current.equityCents * growthFactor;
      position = buildPosition(projectedEquity + mortgage, mortgage, input.costOfSaleBps);
    }

    schedule.push({
      ...position,
      year,
      equityChangeFromTodayCents: cents(position.equityCents - current.equityCents),
    });
  }

  return schedule;
}

function buildAssumptions(input: HomeEquityInput, current: HomeEquityPosition): readonly string[] {
  const assumptions: string[] = [
    "Current equity is market value minus the mortgage payoff balance, both as entered by you. This tool does not appraise property or verify a payoff balance.",
    "Projected figures are a planning scenario only. Florida classifies and values the marital estate as of the Fla. Stat. §61.075(7) cut-off date — generally the earliest of a valid separation agreement date, a date set by that agreement, or the date the petition was filed — so growth after that date is not what a court divides. No statute supplies an appreciation rate; the rate used here is the one you entered.",
  ];

  if (input.growthBasis === "propertyValue") {
    assumptions.push(
      "The growth rate is applied to the home's market value. Because the mortgage is subtracted after growth, equity grows faster in percentage terms than the value does.",
    );
  } else {
    assumptions.push(
      "The growth rate is applied to the equity figure itself, as you asked. This implicitly assumes the mortgage falls in step with the growth; applying the rate to the home's value instead is the more conventional model.",
    );
  }

  if (input.annualPrincipalPaydownCents) {
    assumptions.push(
      "The mortgage balance is reduced by the yearly principal paydown you entered, applied evenly. Real amortization pays down more principal in later years, so this understates equity early and overstates it late.",
    );
  } else {
    assumptions.push(
      "The mortgage balance is held flat, because no yearly principal paydown was entered. Real mortgage payments reduce principal, so this understates future equity.",
    );
  }

  if (input.costOfSaleBps) {
    assumptions.push(
      `Selling costs of ${(input.costOfSaleBps / 100).toFixed(2)}% of the sale price are shown as a separate "after selling costs" figure. They are an estimate and are not deducted from the equity used anywhere else.`,
    );
  }

  if (current.isUnderwater) {
    assumptions.push(
      "The mortgage currently exceeds the home's value, so there is no equity to divide today. The shortfall is a marital liability rather than an asset.",
    );
  }

  return assumptions;
}

/**
 * Computes the current equity position and, when asked, a range of projected
 * positions. Pure: same input, same output, no clock and no I/O.
 */
export function calculateHomeEquity(input: HomeEquityInput): HomeEquityResult {
  assertValid(input);

  const current = buildPosition(input.marketValueCents, input.mortgageBalanceCents, input.costOfSaleBps);

  const rates =
    input.projectionYears === 0
      ? []
      : [...new Set([input.annualAppreciationBps, ...COMPARISON_APPRECIATION_BPS])].sort((a, b) => a - b);

  const projection: HomeEquityScenario[] = rates.map((annualAppreciationBps) => {
    const schedule = buildSchedule(input, annualAppreciationBps, current);
    return {
      annualAppreciationBps,
      isUserSelected: annualAppreciationBps === input.annualAppreciationBps,
      schedule,
      finalYear: schedule[schedule.length - 1],
    };
  });

  return {
    modelVersion: HOME_EQUITY_MODEL_VERSION,
    growthBasis: input.growthBasis,
    projectionYears: input.projectionYears,
    current,
    projection,
    assumptions: buildAssumptions(input, current),
  };
}
