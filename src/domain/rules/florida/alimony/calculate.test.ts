import { describe, expect, it } from "vitest";

import { confirmFact, UnconfirmedInputError } from "../../confirmedFact";
import { calculateFloridaAlimony, type AlimonyInput } from "./index";

function baseParty(netIncomeCents: number) {
  return {
    monthlyGrossIncomeCents: netIncomeCents,
    deductions: {
      federalStateLocalIncomeTaxCents: 0,
      ficaOrSelfEmploymentTaxCents: 0,
      mandatoryRetirementCents: 0,
      healthInsurancePremiumSelfOnlyCents: 0,
      courtOrderedSupportForOtherChildrenPaidCents: 0,
      spousalSupportPaidUnderPriorOrderCents: 0,
    },
  };
}

function baseInput(overrides: Partial<AlimonyInput> = {}): AlimonyInput {
  return {
    marriageDateIso: "2008-07-01",
    petitionFilingDateIso: "2023-07-01",
    payor: baseParty(600_000),
    obligee: baseParty(200_000),
    confirmedReasonableMonthlyNeedCents: 100_000,
    rehabilitativePlanConfirmed: false,
    exceptionalCircumstancesExtensionRequested: false,
    needDisputed: false,
    abilityToPayDisputed: false,
    ...overrides,
  } as AlimonyInput;
}

describe("calculateFloridaAlimony — petition date gate", () => {
  it("returns requiresProfessionalReview for petitions filed before 2023-07-01", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(baseInput({ petitionFilingDateIso: "2023-06-30" }), "user-entered"),
    );
    expect(outcome.kind).toBe("requiresProfessionalReview");
  });

  it("calculates normally for petitions filed exactly on 2023-07-01", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(baseInput({ petitionFilingDateIso: "2023-07-01" }), "user-entered"),
    );
    expect(outcome.kind).toBe("calculated");
  });
});

describe("calculateFloridaAlimony — marriage duration boundaries", () => {
  it("classifies a marriage of 119 months as short-term", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ marriageDateIso: "2013-08-01", petitionFilingDateIso: "2023-07-31" }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.marriageDurationMonths).toBe(119);
    expect(outcome.result.marriageDurationCategory).toBe("short");
  });

  it("classifies a marriage of exactly 120 months (10 years) as moderate-term", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ marriageDateIso: "2013-07-01", petitionFilingDateIso: "2023-07-01" }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.marriageDurationMonths).toBe(120);
    expect(outcome.result.marriageDurationCategory).toBe("moderate");
  });

  it("classifies a marriage of exactly 240 months (20 years) as long-term", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ marriageDateIso: "2003-07-01", petitionFilingDateIso: "2023-07-01" }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.marriageDurationMonths).toBe(240);
    expect(outcome.result.marriageDurationCategory).toBe("long");
  });
});

describe("calculateFloridaAlimony — durational availability and duration caps", () => {
  it("makes durational alimony unavailable for a marriage under 3 years", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ marriageDateIso: "2020-08-01", petitionFilingDateIso: "2023-07-01" }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.marriageDurationMonths).toBe(35);
    const durational = outcome.result.formAvailability.find((f) => f.form === "durational")!;
    expect(durational.available).toBe(false);
    expect(durational.maxDurationMonths).toBeNull();
  });

  it("makes durational alimony available at exactly 3 years", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ marriageDateIso: "2020-07-01", petitionFilingDateIso: "2023-07-01" }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.marriageDurationMonths).toBe(36);
    const durational = outcome.result.formAvailability.find((f) => f.form === "durational")!;
    expect(durational.available).toBe(true);
    expect(durational.maxDurationMonths).toBe(18); // 50% of a short-term marriage
  });

  it("caps a moderate-term (15-year) marriage's durational alimony at 60%", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ marriageDateIso: "2008-07-01", petitionFilingDateIso: "2023-07-01" }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.marriageDurationMonths).toBe(180);
    const durational = outcome.result.formAvailability.find((f) => f.form === "durational")!;
    expect(durational.maxDurationMonths).toBe(108); // 60% of 180 months
  });

  it("caps a long-term marriage's durational alimony at 75%", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ marriageDateIso: "1998-07-01", petitionFilingDateIso: "2023-07-01" }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.marriageDurationMonths).toBe(300);
    const durational = outcome.result.formAvailability.find((f) => f.form === "durational")!;
    expect(durational.maxDurationMonths).toBe(225); // 75% of 300 months
  });

  it("caps bridge-the-gap at 2 years and rehabilitative at 5 years", () => {
    const outcome = calculateFloridaAlimony(confirmFact(baseInput(), "user-entered"));
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.formAvailability.find((f) => f.form === "bridgeTheGap")!.maxDurationMonths).toBe(24);
    expect(outcome.result.formAvailability.find((f) => f.form === "rehabilitative")!.maxDurationMonths).toBe(60);
  });

  it("marks rehabilitative alimony unavailable without a confirmed plan, available with one", () => {
    const withoutPlan = calculateFloridaAlimony(confirmFact(baseInput(), "user-entered"));
    if (withoutPlan.kind !== "calculated") throw new Error("expected calculated");
    expect(withoutPlan.result.formAvailability.find((f) => f.form === "rehabilitative")!.available).toBe(false);

    const withPlan = calculateFloridaAlimony(
      confirmFact(baseInput({ rehabilitativePlanConfirmed: true }), "user-entered"),
    );
    if (withPlan.kind !== "calculated") throw new Error("expected calculated");
    expect(withPlan.result.formAvailability.find((f) => f.form === "rehabilitative")!.available).toBe(true);
  });

  it("flags a requested exceptional-circumstances extension without computing it", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(baseInput({ exceptionalCircumstancesExtensionRequested: true }), "user-entered"),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(
      outcome.warnings.some((w) => w.flagId === "exceptionalCircumstancesExtensionRequested"),
    ).toBe(true);
  });
});

describe("calculateFloridaAlimony — amount ceiling", () => {
  it("uses the confirmed reasonable need when it is the smaller figure", () => {
    // payor 600,000 - obligee 200,000 = 400,000 diff; 35% = 140,000; need = 100,000.
    const outcome = calculateFloridaAlimony(
      confirmFact(baseInput({ confirmedReasonableMonthlyNeedCents: 100_000 }), "user-entered"),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.amountCeiling.rangeCeilingCents).toBe(100_000);
    expect(outcome.result.amountCeiling.limitingFactor).toBe("reasonableNeed");
    expect(outcome.result.amountCeiling.rangeFloorCents).toBe(0);
  });

  it("uses 35% of the income difference when it is the smaller figure", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(baseInput({ confirmedReasonableMonthlyNeedCents: 500_000 }), "user-entered"),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.amountCeiling.rangeCeilingCents).toBe(140_000);
    expect(outcome.result.amountCeiling.limitingFactor).toBe("thirtyFivePercentIncomeDifference");
  });

  it("computes an illustrative post-scenario cash flow at the ceiling amount", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(baseInput({ confirmedReasonableMonthlyNeedCents: 100_000 }), "user-entered"),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.postScenarioCashFlowAtCeiling.payorNetMonthlyIncomeAfterCents).toBe(500_000);
    expect(outcome.result.postScenarioCashFlowAtCeiling.obligeeNetMonthlyIncomeAfterCents).toBe(300_000);
  });

  it("floors the ceiling at $0 and warns when the obligee's income meets or exceeds the payor's", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ payor: baseParty(150_000), obligee: baseParty(200_000) }),
        "user-entered",
      ),
    );
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.amountCeiling.rangeCeilingCents).toBe(0);
    expect(outcome.warnings.some((w) => w.flagId === "obligeeIncomeMeetsOrExceedsPayorIncome")).toBe(true);
    expect(outcome.warnings.some((w) => w.flagId === "significantlyLessNetIncome")).toBe(true);
  });
});

describe("calculateFloridaAlimony — subsection (3) factors", () => {
  it("includes all eight subsection (3) factor IDs", () => {
    const outcome = calculateFloridaAlimony(confirmFact(baseInput(), "user-entered"));
    if (outcome.kind !== "calculated") throw new Error("expected calculated");
    expect(outcome.result.subsectionThreeFactors.map((f) => f.factorId)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ]);
  });
});

describe("calculateFloridaAlimony — need/ability disputes", () => {
  it("returns requiresProfessionalReview when need is disputed", () => {
    const outcome = calculateFloridaAlimony(confirmFact(baseInput({ needDisputed: true }), "user-entered"));
    expect(outcome.kind).toBe("requiresProfessionalReview");
  });

  it("returns requiresProfessionalReview when ability to pay is disputed", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(baseInput({ abilityToPayDisputed: true }), "user-entered"),
    );
    expect(outcome.kind).toBe("requiresProfessionalReview");
  });
});

describe("calculateFloridaAlimony — invalid inputs", () => {
  it("returns needsInput when the petition filing date precedes the marriage date", () => {
    const outcome = calculateFloridaAlimony(
      confirmFact(
        baseInput({ marriageDateIso: "2023-07-01", petitionFilingDateIso: "2020-01-01" }),
        "user-entered",
      ),
    );
    expect(outcome.kind).toBe("needsInput");
  });

  it("returns needsInput when confirmedReasonableMonthlyNeedCents is missing", () => {
    const rest: Record<string, unknown> = { ...baseInput() };
    delete rest.confirmedReasonableMonthlyNeedCents;
    const outcome = calculateFloridaAlimony(confirmFact(rest as unknown as AlimonyInput, "user-entered"));
    expect(outcome.kind).toBe("needsInput");
  });

  it("rejects extraction-shaped (unconfirmed) data at the runtime boundary", () => {
    const extractionProposal = { value: baseInput(), confidence: 0.9 };
    expect(() =>
      // @ts-expect-error intentionally passing a non-ConfirmedFact to prove the runtime guard rejects it
      calculateFloridaAlimony(extractionProposal),
    ).toThrow(UnconfirmedInputError);
  });
});
