import { describe, expect, it } from "vitest";

import {
  addCents,
  allocateProportionally,
  basisPointsOfCents,
  cents,
  clampToZero,
  ratioOfCents,
  roundHalfUp,
  subtractCents,
  twoWayBasisPointShare,
} from "./money";

describe("cents", () => {
  it("accepts integers", () => {
    expect(cents(100)).toBe(100);
  });

  it("rejects non-integers", () => {
    expect(() => cents(100.5)).toThrow(RangeError);
  });
});

describe("roundHalfUp", () => {
  it("rounds .5 away from zero", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
  });

  it("rounds down below .5", () => {
    expect(roundHalfUp(2.4999)).toBe(2);
  });
});

describe("basisPointsOfCents", () => {
  it("computes exact percentages", () => {
    expect(basisPointsOfCents(cents(100_000), 3_500)).toBe(35_000);
  });

  it("rounds half up", () => {
    // 5 * 0.125 = 0.625 -> rounds to 1
    expect(basisPointsOfCents(cents(5), 1_250)).toBe(1);
  });
});

describe("ratioOfCents", () => {
  it("throws on zero denominator", () => {
    expect(() => ratioOfCents(cents(100), 1, 0)).toThrow(RangeError);
  });
});

describe("twoWayBasisPointShare", () => {
  it("splits evenly for equal weights", () => {
    expect(twoWayBasisPointShare(cents(100), cents(100))).toEqual([5_000, 5_000]);
  });

  it("complements to exactly 10000 for uneven weights", () => {
    const [a, b] = twoWayBasisPointShare(cents(1), cents(2));
    expect(a + b).toBe(10_000);
  });

  it("returns zero for zero total", () => {
    expect(twoWayBasisPointShare(cents(0), cents(0))).toEqual([0, 0]);
  });
});

describe("allocateProportionally", () => {
  it("sums exactly to the total even with rounding remainders", () => {
    const shares = allocateProportionally(cents(100), [1, 1, 1]);
    expect(shares.reduce((sum, v) => sum + v, 0)).toBe(100);
    expect(shares).toEqual([34, 33, 33]);
  });

  it("handles a zero total total weight", () => {
    expect(allocateProportionally(cents(500), [0, 0])).toEqual([0, 0]);
  });

  it("allocates two-way shares that sum to the total for odd cents", () => {
    const shares = allocateProportionally(cents(101), [5_000, 5_000]);
    expect(shares[0] + shares[1]).toBe(101);
  });
});

describe("addCents/subtractCents/clampToZero", () => {
  it("adds a list of cents", () => {
    expect(addCents(cents(100), cents(200), cents(300))).toBe(600);
  });

  it("subtracts and clamps negative to zero", () => {
    expect(clampToZero(subtractCents(cents(100), cents(300)))).toBe(0);
  });
});
