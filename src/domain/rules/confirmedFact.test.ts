import { describe, expect, it } from "vitest";

import {
  assertConfirmedFact,
  confirmFact,
  isConfirmedFact,
  UnconfirmedInputError,
} from "./confirmedFact";

describe("confirmFact / isConfirmedFact", () => {
  it("round-trips a confirmed value", () => {
    const fact = confirmFact({ amountCents: 100 }, "user-entered");
    expect(isConfirmedFact(fact)).toBe(true);
    expect(fact.value).toEqual({ amountCents: 100 });
    expect(fact.source).toBe("user-entered");
  });

  it("rejects a plain object with the same shape", () => {
    const notConfirmed = { value: { amountCents: 100 }, source: "user-entered", confirmedAt: "x" };
    expect(isConfirmedFact(notConfirmed)).toBe(false);
  });

  it("rejects an extraction-proposal-shaped object", () => {
    // Shaped like an AI/document extraction proposal — has a confidence
    // score and a proposed value, but was never routed through confirmFact.
    const extractionProposal = {
      value: { monthlyGrossIncomeCents: 500_000 },
      confidence: 0.87,
      extractionSource: "document-ocr",
    };
    expect(isConfirmedFact(extractionProposal)).toBe(false);
  });

  it("rejects data round-tripped through JSON (brand does not survive serialization)", () => {
    const fact = confirmFact({ amountCents: 100 }, "user-entered");
    const serialized = JSON.parse(JSON.stringify(fact));
    expect(isConfirmedFact(serialized)).toBe(false);
  });

  it("rejects null and primitives", () => {
    expect(isConfirmedFact(null)).toBe(false);
    expect(isConfirmedFact(42)).toBe(false);
    expect(isConfirmedFact("hello")).toBe(false);
  });
});

describe("assertConfirmedFact", () => {
  it("passes through a real ConfirmedFact", () => {
    const fact = confirmFact(1, "user-entered");
    expect(() => assertConfirmedFact(fact)).not.toThrow();
  });

  it("throws UnconfirmedInputError for extraction-shaped data", () => {
    const extractionProposal = { value: 1, confidence: 0.5 };
    expect(() => assertConfirmedFact(extractionProposal)).toThrow(UnconfirmedInputError);
  });
});
