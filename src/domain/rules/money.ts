/**
 * Exact integer-cent arithmetic helpers.
 *
 * Every monetary value in this rules engine is an integer number of cents
 * (never a floating-point dollar amount), and every rounding operation is
 * explicit and deterministic (round-half-up on non-negative magnitudes).
 * Proportional allocations use the largest-remainder method so that
 * individually-rounded shares always sum back to exactly the original total
 * — no cent is ever silently created or lost to rounding drift.
 */

export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Cents values must be integers; received ${value}.`);
  }
  return value as Cents;
}

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isInteger(value);
}

export const ZERO_CENTS: Cents = cents(0);

export function addCents(...values: readonly Cents[]): Cents {
  return cents(values.reduce((sum, value) => sum + value, 0));
}

export function subtractCents(minuend: Cents, subtrahend: Cents): Cents {
  return cents(minuend - subtrahend);
}

export function clampToZero(value: Cents): Cents {
  return value < 0 ? ZERO_CENTS : value;
}

export function maxCents(...values: readonly Cents[]): Cents {
  return cents(Math.max(...values));
}

export function minCents(...values: readonly Cents[]): Cents {
  return cents(Math.min(...values));
}

/** Rounds half away from zero. Used for every derived monetary figure. */
export function roundHalfUp(value: number): number {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

/** `basisPoints` of 10_000 == 100%. e.g. 3_500 == 35.00%. */
export function basisPointsOfCents(amount: Cents, basisPoints: number): Cents {
  return cents(roundHalfUp((amount * basisPoints) / 10_000));
}

export function ratioOfCents(amount: Cents, numerator: number, denominator: number): Cents {
  if (denominator === 0) {
    throw new RangeError("Cannot compute a ratio of cents with a zero denominator.");
  }
  return cents(roundHalfUp((amount * numerator) / denominator));
}

/**
 * Computes `numerator / (numerator + otherNumerator)` expressed in basis
 * points (0-10_000), rounded half-up, for exactly two weights. The
 * complementary share (`10_000 - result`) is guaranteed to be the correct
 * "other side" percentage — the two never round to something that sums to
 * more or less than 10_000.
 */
export function twoWayBasisPointShare(weight: Cents, otherWeight: Cents): [number, number] {
  const total = weight + otherWeight;
  if (total <= 0) {
    return [0, 0];
  }
  const share = roundHalfUp((weight * 10_000) / total);
  const clamped = Math.min(10_000, Math.max(0, share));
  return [clamped, 10_000 - clamped];
}

/**
 * Allocates `totalCents` across `weights` proportionally using the
 * largest-remainder method, guaranteeing the results always sum to exactly
 * `totalCents` even though each share is independently rounded to the
 * nearest cent.
 */
export function allocateProportionally(totalCents: Cents, weights: readonly number[]): Cents[] {
  if (weights.some((weight) => weight < 0)) {
    throw new RangeError("Allocation weights must be non-negative.");
  }
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum === 0) {
    return weights.map(() => ZERO_CENTS);
  }

  const rawShares = weights.map((weight) => (totalCents * weight) / weightSum);
  const flooredShares = rawShares.map((raw) => Math.floor(raw));
  const flooredSum = flooredShares.reduce((sum, value) => sum + value, 0);
  let remainder = totalCents - flooredSum;

  const remainderOrder = rawShares
    .map((raw, index) => ({ index, fraction: raw - flooredShares[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...flooredShares];
  for (let i = 0; i < remainderOrder.length && remainder > 0; i += 1) {
    result[remainderOrder[i].index] += 1;
    remainder -= 1;
  }

  return result.map((value) => cents(value));
}
