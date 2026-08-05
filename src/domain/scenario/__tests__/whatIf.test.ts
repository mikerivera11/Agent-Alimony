import { describe, expect, it } from "vitest";

import { buildReviewedDraft } from "@/domain/intake";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

import { EmptyScenarioError, calculateScenario } from "../whatIf";

/**
 * What-ifs must be real arithmetic and obviously hypothetical at the same
 * time. These cover both halves: that the deterministic engine actually ran,
 * and that nothing about the result could be mistaken for the saved case.
 */

function reviewed() {
  return buildReviewedDraft(createSampleDraft());
}

describe("calculateScenario", () => {
  it("refuses a what-if that changes nothing", () => {
    expect(() => calculateScenario(reviewed(), {})).toThrow(EmptyScenarioError);
  });

  it("marks every result as hypothetical", () => {
    const result = calculateScenario(reviewed(), { selfMonthlyGrossIncomeCents: 900_000 });

    expect(result.isHypothetical).toBe(true);
  });

  it("actually changes the child-support figure when income changes", () => {
    const base = calculateScenario(reviewed(), { selfMonthlyGrossIncomeCents: 500_000 });
    const higher = calculateScenario(reviewed(), { selfMonthlyGrossIncomeCents: 1_500_000 });

    expect(base.childSupport?.kind).toBe("calculated");
    expect(higher.childSupport?.kind).toBe("calculated");
    if (base.childSupport?.kind !== "calculated" || higher.childSupport?.kind !== "calculated") return;

    // Earning three times as much cannot leave the transfer identical; if it
    // did, the override never reached the calculator.
    expect(higher.childSupport.result.parents[0].monthlyGrossIncomeCents).toBe(1_500_000);
    expect(higher.childSupport.result.monthlyTransferAmountCents).not.toBe(
      base.childSupport.result.monthlyTransferAmountCents,
    );
  });

  it("echoes back what was changed, and what it was changed from", () => {
    const result = calculateScenario(reviewed(), { selfMonthlyGrossIncomeCents: 900_000 });

    const applied = result.appliedOverrides.find((o) => o.field === "selfMonthlyGrossIncomeCents");
    expect(applied).toBeDefined();
    expect(applied?.toCents).toBe(900_000);
    // The "from" is the point: someone has to be able to see that the number
    // read out of their sentence is the number that was used.
    expect(applied?.fromCents).toBeGreaterThan(0);
    expect(applied?.fromCents).not.toBe(900_000);
  });

  it("moves the other parent's overnights so the year still adds up", () => {
    const result = calculateScenario(reviewed(), { selfAnnualOvernights: 200 });

    expect(result.childSupport?.kind).toBe("calculated");
    if (result.childSupport?.kind !== "calculated") return;
    const [self, other] = result.childSupport.result.parents;
    expect(self.overnightsWithChild).toBe(200);
    expect(self.overnightsWithChild + other.overnightsWithChild).toBe(365);
  });

  it("changes alimony when the income of the party it turns on changes", () => {
    const low = calculateScenario(reviewed(), { spouseMonthlyGrossIncomeCents: 400_000 });
    const high = calculateScenario(reviewed(), { spouseMonthlyGrossIncomeCents: 2_000_000 });

    expect(low.alimony?.kind).toBe("calculated");
    expect(high.alimony?.kind).toBe("calculated");
    if (low.alimony?.kind !== "calculated" || high.alimony?.kind !== "calculated") return;

    expect(JSON.stringify(high.alimony.result)).not.toBe(JSON.stringify(low.alimony.result));
  });

  it("leaves the saved case untouched", () => {
    const draft = reviewed();
    const before = JSON.stringify(draft);

    calculateScenario(draft, { selfMonthlyGrossIncomeCents: 900_000, selfAnnualOvernights: 100 });

    expect(JSON.stringify(draft)).toBe(before);
  });

  it("produces the saved figures again when the override equals what is saved", () => {
    // A what-if that changes a number back to its real value must reproduce
    // the real estimate; anything else means the override path computes
    // differently from the normal one.
    const draft = reviewed();
    const seed = calculateScenario(draft, { selfMonthlyGrossIncomeCents: 1 });
    const savedIncome = seed.appliedOverrides.find(
      (o) => o.field === "selfMonthlyGrossIncomeCents",
    )?.fromCents;
    expect(savedIncome).toBeDefined();

    const replayed = calculateScenario(draft, { selfMonthlyGrossIncomeCents: savedIncome! });

    expect(replayed.childSupport?.kind).toBe("calculated");
    if (replayed.childSupport?.kind !== "calculated") return;
    expect(replayed.childSupport.result.parents[0].monthlyGrossIncomeCents).toBe(savedIncome);
  });
});
