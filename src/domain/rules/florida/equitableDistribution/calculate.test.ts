import { describe, expect, it } from "vitest";

import { confirmFact, UnconfirmedInputError } from "../../confirmedFact";
import {
  calculateFloridaEquitableDistribution,
  EQUITABLE_DISTRIBUTION_FACTORS,
  FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
  type EquitableDistributionInput,
  type EquitableDistributionItem,
} from "./index";

function item(overrides: Partial<EquitableDistributionItem> & { id: string }): EquitableDistributionItem {
  return {
    label: `Item ${overrides.id}`,
    category: "bankAccount",
    type: "asset",
    valueCents: 0,
    classification: "marital",
    owner: "a",
    excludedByWrittenAgreement: false,
    commingledWithMaritalFunds: false,
    ...overrides,
  } as EquitableDistributionItem;
}

function input(overrides: Partial<EquitableDistributionInput> = {}): EquitableDistributionInput {
  return {
    items: [],
    writtenAgreementConfirmed: false,
    partyALabel: "Spouse A",
    partyBLabel: "Spouse B",
    unequalDistributionRequested: false,
    dissipationClaimPresent: false,
    nonmaritalMortgagePaydownClaimPresent: false,
    ...overrides,
  } as EquitableDistributionInput;
}

function calc(overrides: Partial<EquitableDistributionInput> = {}) {
  return calculateFloridaEquitableDistribution(confirmFact(input(overrides), "user-entered"));
}

describe("calculateFloridaEquitableDistribution — confirmed-fact boundary", () => {
  it("throws when handed unconfirmed input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => calculateFloridaEquitableDistribution(input() as any)).toThrow(UnconfirmedInputError);
  });
});

describe("calculateFloridaEquitableDistribution — input validation", () => {
  it("returns needsInput when a nonmarital item omits its statutory basis", () => {
    const outcome = calc({
      items: [item({ id: "x", classification: "nonmarital", owner: "a", valueCents: 100 })],
    });
    expect(outcome.kind).toBe("needsInput");
    if (outcome.kind !== "needsInput") throw new Error("expected needsInput");
    expect(outcome.missingFacts.some((f) => f.factId.includes("nonmaritalBasis"))).toBe(true);
  });

  it("returns needsInput on duplicate item ids", () => {
    const outcome = calc({
      items: [item({ id: "dup", valueCents: 100 }), item({ id: "dup", valueCents: 200 })],
    });
    expect(outcome.kind).toBe("needsInput");
  });

  it("returns needsInput when a liability value is negative", () => {
    const outcome = calc({
      items: [item({ id: "n", type: "liability", valueCents: -5 })],
    });
    expect(outcome.kind).toBe("needsInput");
  });
});

describe("calculateFloridaEquitableDistribution — equal split baseline", () => {
  it("splits a wholly one-sided marital estate with an equalizing payment", () => {
    const outcome = calc({
      items: [item({ id: "house-equity", category: "realProperty", owner: "a", valueCents: 100_000 })],
    });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const d = outcome.result.distributionWithExclusions;
    expect(d.netMaritalEstateCents).toBe(100_000);
    expect(d.targetShareACents).toBe(50_000);
    expect(d.targetShareBCents).toBe(50_000);
    expect(d.holdingACents).toBe(100_000);
    expect(d.holdingBCents).toBe(0);
    expect(d.equalizingPayment).toEqual({ fromSpouse: "a", toSpouse: "b", amountCents: 50_000 });
    expect(d.negativeEstate).toBe(false);
  });

  it("requires no payment when holdings are already equal", () => {
    const outcome = calc({
      items: [
        item({ id: "a-acct", owner: "a", valueCents: 60_000 }),
        item({ id: "b-acct", owner: "b", valueCents: 60_000 }),
      ],
    });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const d = outcome.result.distributionWithExclusions;
    expect(d.equalizingPayment).toEqual({ fromSpouse: null, toSpouse: null, amountCents: 0 });
  });

  it("nets marital liabilities against marital assets", () => {
    const outcome = calc({
      items: [
        item({ id: "acct", owner: "a", valueCents: 100_000 }),
        item({ id: "card", category: "creditCardDebt", type: "liability", owner: "b", valueCents: 20_000 }),
      ],
    });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const d = outcome.result.distributionWithExclusions;
    expect(d.maritalAssetsCents).toBe(100_000);
    expect(d.maritalLiabilitiesCents).toBe(20_000);
    expect(d.netMaritalEstateCents).toBe(80_000);
    // A holds +100000, B holds -20000; equal target 40000 each. A pays B 60000.
    expect(d.holdingACents).toBe(100_000);
    expect(d.holdingBCents).toBe(-20_000);
    expect(d.equalizingPayment).toEqual({ fromSpouse: "a", toSpouse: "b", amountCents: 60_000 });
  });
});

describe("calculateFloridaEquitableDistribution — nonmarital set-aside", () => {
  it("sets apart nonmarital property to its owner and excludes it from the estate", () => {
    const outcome = calc({
      items: [
        item({ id: "marital", owner: "a", valueCents: 40_000 }),
        item({
          id: "inheritance",
          owner: "b",
          valueCents: 500_000,
          classification: "nonmarital",
          nonmaritalBasis: "separateGiftOrInheritance",
        }),
      ],
    });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const { nonmaritalSetAside, distributionWithExclusions } = outcome.result;
    expect(nonmaritalSetAside.items).toHaveLength(1);
    expect(nonmaritalSetAside.bNetCents).toBe(500_000);
    expect(nonmaritalSetAside.aNetCents).toBe(0);
    expect(nonmaritalSetAside.items[0].basisCitation).toBe("Fla. Stat. §61.075(6)(b)2");
    // Only the $400 marital item is in the estate.
    expect(distributionWithExclusions.netMaritalEstateCents).toBe(40_000);
  });
});

describe("calculateFloridaEquitableDistribution — written-agreement exclusions", () => {
  const excludedItems = [
    item({ id: "keep", owner: "a", valueCents: 100_000 }),
    item({ id: "excluded", owner: "a", valueCents: 40_000, excludedByWrittenAgreement: true }),
  ];

  it("honors an exclusion when a written agreement is confirmed and reports both scenarios", () => {
    const outcome = calc({ items: excludedItems, writtenAgreementConfirmed: true });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const { baselineWithoutExclusions, distributionWithExclusions, exclusions } = outcome.result;

    expect(baselineWithoutExclusions.netMaritalEstateCents).toBe(140_000);
    expect(baselineWithoutExclusions.equalizingPayment.amountCents).toBe(70_000);

    expect(distributionWithExclusions.netMaritalEstateCents).toBe(100_000);
    expect(distributionWithExclusions.equalizingPayment.amountCents).toBe(50_000);

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0].honored).toBe(true);
    // No blocking flag when the agreement is confirmed.
    expect(outcome.warnings.some((w) => w.flagId.startsWith("writtenAgreementRequired"))).toBe(false);
  });

  it("does NOT honor an exclusion without a confirmed agreement and raises a blocking flag", () => {
    const outcome = calc({ items: excludedItems, writtenAgreementConfirmed: false });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const { baselineWithoutExclusions, distributionWithExclusions, exclusions } = outcome.result;

    // With and without are identical because the exclusion is not applied.
    expect(distributionWithExclusions.netMaritalEstateCents).toBe(140_000);
    expect(baselineWithoutExclusions.netMaritalEstateCents).toBe(140_000);
    expect(exclusions[0].honored).toBe(false);

    const flag = outcome.warnings.find((w) => w.flagId === "writtenAgreementRequired.excluded");
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe("blocking");
    expect(flag?.citation).toBe("Fla. Stat. §61.075(6)(b)4");
  });

  it("warns about QDRO/marital-accrual when a retirement asset is excluded", () => {
    const outcome = calc({
      items: [
        item({ id: "keep", owner: "a", valueCents: 100_000 }),
        item({
          id: "401k",
          category: "retirementAccount",
          owner: "b",
          valueCents: 200_000,
          excludedByWrittenAgreement: true,
        }),
      ],
      writtenAgreementConfirmed: true,
    });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const flag = outcome.warnings.find((w) => w.flagId === "retirementExclusion.401k");
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe("warning");
    expect(flag?.description).toMatch(/QDRO/);
    expect(flag?.citation).toBe("Fla. Stat. §61.075(6)(a)1.e");
  });
});

describe("calculateFloridaEquitableDistribution — edge and rounding cases", () => {
  it("handles a negative marital estate (liabilities exceed assets)", () => {
    const outcome = calc({
      items: [item({ id: "loan", category: "loan", type: "liability", owner: "a", valueCents: 100_000 })],
    });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const d = outcome.result.distributionWithExclusions;
    expect(d.netMaritalEstateCents).toBe(-100_000);
    expect(d.negativeEstate).toBe(true);
    expect(d.targetShareACents).toBe(-50_000);
    expect(d.targetShareBCents).toBe(-50_000);
    // A holds the entire debt; B pays A 50000 to share it equally.
    expect(d.equalizingPayment).toEqual({ fromSpouse: "b", toSpouse: "a", amountCents: 50_000 });
    expect(outcome.warnings.some((w) => w.flagId === "negativeMaritalEstate")).toBe(true);
  });

  it("handles a zero-asset case with no marital items", () => {
    const outcome = calc({ items: [] });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const d = outcome.result.distributionWithExclusions;
    expect(d.netMaritalEstateCents).toBe(0);
    expect(d.equalizingPayment).toEqual({ fromSpouse: null, toSpouse: null, amountCents: 0 });
    expect(outcome.warnings.some((w) => w.flagId === "noMaritalEstate")).toBe(true);
  });

  it("rounds an odd-cent estate so shares always sum back to the net", () => {
    const outcome = calc({
      items: [item({ id: "odd", owner: "a", valueCents: 101 })],
    });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const d = outcome.result.distributionWithExclusions;
    expect(d.targetShareACents + d.targetShareBCents).toBe(101);
    expect(d.targetShareACents).toBe(51);
    expect(d.targetShareBCents).toBe(50);
    // A holds 101, target 51 → pays B 50, leaving 51/50.
    expect(d.equalizingPayment).toEqual({ fromSpouse: "a", toSpouse: "b", amountCents: 50 });
  });

  it("splits a jointly held odd-cent item without drift", () => {
    const outcome = calc({
      items: [item({ id: "joint", owner: "joint", valueCents: 101 })],
    });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    const d = outcome.result.distributionWithExclusions;
    expect(d.holdingACents).toBe(51);
    expect(d.holdingBCents).toBe(50);
    expect(d.holdingACents + d.holdingBCents).toBe(101);
    // Already essentially equal; the 1-cent target remainder means no transfer.
    expect(d.equalizingPayment.amountCents).toBe(0);
  });
});

describe("calculateFloridaEquitableDistribution — deliberately unimplemented branches", () => {
  it("requires professional review for a disputed classification", () => {
    const outcome = calc({ items: [item({ id: "d", classification: "disputed", valueCents: 100 })] });
    expect(outcome.kind).toBe("requiresProfessionalReview");
    if (outcome.kind !== "requiresProfessionalReview") throw new Error("unreachable");
    expect(outcome.flags[0].flagId).toBe("disputedClassification.d");
  });

  it("requires professional review for a marital closely held business", () => {
    const outcome = calc({
      items: [item({ id: "biz", category: "business", classification: "marital", valueCents: 500_000 })],
    });
    expect(outcome.kind).toBe("requiresProfessionalReview");
    if (outcome.kind !== "requiresProfessionalReview") throw new Error("unreachable");
    expect(outcome.flags[0].citation).toBe("Fla. Stat. §61.075(6)(a)1.f");
  });

  it("requires professional review when an unequal distribution is requested", () => {
    const outcome = calc({
      items: [item({ id: "a", owner: "a", valueCents: 100_000 })],
      unequalDistributionRequested: true,
    });
    expect(outcome.kind).toBe("requiresProfessionalReview");
    if (outcome.kind !== "requiresProfessionalReview") throw new Error("unreachable");
    expect(outcome.flags[0].flagId).toBe("unequalDistributionRequested");
  });

  it("requires professional review for a dissipation claim", () => {
    const outcome = calc({
      items: [item({ id: "a", owner: "a", valueCents: 100_000 })],
      dissipationClaimPresent: true,
    });
    expect(outcome.kind).toBe("requiresProfessionalReview");
    if (outcome.kind !== "requiresProfessionalReview") throw new Error("unreachable");
    expect(outcome.flags[0].citation).toBe("Fla. Stat. §61.075(1)(i)");
  });

  it("requires professional review for a nonmarital mortgage paydown claim", () => {
    const outcome = calc({
      items: [item({ id: "a", owner: "a", valueCents: 100_000 })],
      nonmaritalMortgagePaydownClaimPresent: true,
    });
    expect(outcome.kind).toBe("requiresProfessionalReview");
    if (outcome.kind !== "requiresProfessionalReview") throw new Error("unreachable");
    expect(outcome.flags[0].citation).toBe("Fla. Stat. §61.075(6)(a)1.c");
  });

  it("does not block a business interest that is excluded by a confirmed agreement", () => {
    const outcome = calc({
      items: [
        item({ id: "keep", owner: "a", valueCents: 100_000 }),
        item({ id: "biz", category: "business", owner: "b", valueCents: 500_000, excludedByWrittenAgreement: true }),
      ],
      writtenAgreementConfirmed: true,
    });
    expect(outcome.kind).toBe("calculated");
  });
});

describe("calculateFloridaEquitableDistribution — statutory factors & metadata", () => {
  it("returns all ten §61.075(1) factors as unscored display data", () => {
    const outcome = calc({ items: [item({ id: "a", owner: "a", valueCents: 100_000 })] });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.unequalDistributionFactors).toBe(EQUITABLE_DISTRIBUTION_FACTORS);
    expect(EQUITABLE_DISTRIBUTION_FACTORS.map((f) => f.factorId)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
    ]);
    expect(EQUITABLE_DISTRIBUTION_FACTORS[0].citation).toBe("Fla. Stat. §61.075(1)(a)");
  });

  it("carries the ruleset id and §61.075 citation on the outcome", () => {
    const outcome = calc({ items: [item({ id: "a", owner: "a", valueCents: 100_000 })] });
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.rulesetId).toBe(FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID);
    expect(outcome.citations[0].citation).toBe("Fla. Stat. §61.075");
    expect(outcome.formulaTrace.some((s) => s.stepId === "distribution-with-exclusions")).toBe(true);
    expect(outcome.formulaTrace.some((s) => s.stepId === "baseline-without-exclusions")).toBe(true);
  });
});

describe("premarital and other separate property that was commingled", () => {
  const premaritalSavings = {
    id: "savings",
    label: "Savings from before the marriage",
    category: "bankAccount" as const,
    valueCents: 80_000_00,
    classification: "nonmarital" as const,
    nonmaritalBasis: "acquiredBeforeMarriage" as const,
    owner: "a" as const,
  };

  it("sets premarital savings aside when it was kept separate", () => {
    const outcome = calc({
      items: [
        item(premaritalSavings),
        item({ id: "joint", valueCents: 100_000_00, owner: "joint" }),
      ],
    });

    expect(outcome.kind).toBe("calculated");
    if (outcome.kind !== "calculated") throw new Error("unreachable");

    // The $80k stays out of the estate entirely, so only the $100k is split.
    expect(outcome.result.distributionWithExclusions.netMaritalEstateCents).toBe(100_000_00);
  });

  it("escalates rather than guessing when premarital savings were commingled", () => {
    // Tracing commingled funds is an evidentiary exercise over statements this
    // tool has never seen. Both possible guesses — setting the whole amount
    // aside, or none of it — would be materially wrong.
    const outcome = calc({
      items: [
        item({ ...premaritalSavings, commingledWithMaritalFunds: true }),
        item({ id: "joint", valueCents: 100_000_00, owner: "joint" }),
      ],
    });

    expect(outcome.kind).toBe("requiresProfessionalReview");
    if (outcome.kind !== "requiresProfessionalReview") throw new Error("unreachable");

    expect(outcome.flags.map((flag) => flag.flagId)).toContain("tracingRequired.savings");
    expect(outcome.flags[0].citation).toBe("Fla. Stat. §61.075(6)(a)1.b");
    expect(outcome.reason).toContain("traced");
  });

  it("names each commingled item so the user knows which ones need tracing", () => {
    const outcome = calc({
      items: [
        item({ ...premaritalSavings, commingledWithMaritalFunds: true }),
        item({
          id: "inheritance",
          label: "Inheritance from my father",
          valueCents: 50_000_00,
          classification: "nonmarital",
          nonmaritalBasis: "separateGiftOrInheritance",
          commingledWithMaritalFunds: true,
        }),
      ],
    });

    expect(outcome.kind).toBe("requiresProfessionalReview");
    if (outcome.kind !== "requiresProfessionalReview") throw new Error("unreachable");

    expect(outcome.flags.map((flag) => flag.flagId).sort()).toEqual([
      "tracingRequired.inheritance",
      "tracingRequired.savings",
    ]);
    expect(outcome.flags.map((flag) => flag.description).join(" ")).toContain(
      "Inheritance from my father",
    );
  });

  it("ignores the commingling flag on an item that is already marital", () => {
    // A marital item is in the estate regardless, so mixing is irrelevant and
    // must not escalate the whole case.
    const outcome = calc({
      items: [item({ id: "joint", valueCents: 100_000_00, classification: "marital" })],
    });

    expect(outcome.kind).toBe("calculated");
  });
});
