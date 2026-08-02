import { describe, expect, it } from "vitest";

import type { HouseholdExpenses, PersonDeductions, PersonIncome } from "@/domain/intake";

import {
  deriveReasonableMonthlyNeed,
  resolveReasonableMonthlyNeed,
  sumMonthlyHouseholdExpensesDollars,
} from "../reasonableNeed";

const zeroIncome: PersonIncome = {
  wages: 0,
  selfEmploymentIncome: 0,
  bonusesAndCommissions: 0,
  equityCompensation: 0,
  investmentIncome: 0,
  recurringCapitalGains: 0,
  nonrecurringGains: 0,
  rentalIncome: 0,
  retirementOrPensionIncome: 0,
  unemploymentBenefits: 0,
  disabilityBenefits: 0,
  otherIncome: 0,
};

const zeroDeductions: PersonDeductions = {
  federalAndStateTaxWithholding: 0,
  socialSecurityAndMedicareTax: 0,
  mandatoryRetirementContributions: 0,
  healthInsurancePremiumsForSelf: 0,
  courtOrderedChildSupportPaidForOtherChildren: 0,
  spousalSupportPaidUnderPriorOrder: 0,
  unionDues: 0,
};

const zeroExpenses: HouseholdExpenses = {
  housingMonthly: 0,
  utilitiesMonthly: 0,
  foodMonthly: 0,
  transportationMonthly: 0,
  insuranceMonthly: 0,
  minimumDebtPaymentsMonthly: 0,
  otherMonthlyExpenses: 0,
};

describe("sumMonthlyHouseholdExpensesDollars", () => {
  it("sums every expense category", () => {
    const total = sumMonthlyHouseholdExpensesDollars({
      housingMonthly: 1800,
      utilitiesMonthly: 250,
      foodMonthly: 600,
      transportationMonthly: 400,
      insuranceMonthly: 150,
      minimumDebtPaymentsMonthly: 300,
      otherMonthlyExpenses: 100,
    });

    expect(total).toBe(3600);
  });
});

describe("deriveReasonableMonthlyNeed", () => {
  it("subtracts the recipient's net income from the monthly budget", () => {
    const derived = deriveReasonableMonthlyNeed(
      { ...zeroExpenses, housingMonthly: 2000, foodMonthly: 500 },
      { ...zeroIncome, wages: 1500 },
      { ...zeroDeductions, federalAndStateTaxWithholding: 200 },
    );

    expect(derived.monthlyLivingExpensesCents).toBe(250_000);
    expect(derived.recipientNetMonthlyIncomeCents).toBe(130_000);
    expect(derived.derivedMonthlyNeedCents).toBe(120_000);
  });

  it("floors the need at zero when income already covers expenses", () => {
    const derived = deriveReasonableMonthlyNeed(
      { ...zeroExpenses, housingMonthly: 1000 },
      { ...zeroIncome, wages: 5000 },
      zeroDeductions,
    );

    expect(derived.derivedMonthlyNeedCents).toBe(0);
  });

  it("floors net income at zero when deductions exceed gross income", () => {
    const derived = deriveReasonableMonthlyNeed(
      { ...zeroExpenses, housingMonthly: 1000 },
      { ...zeroIncome, wages: 100 },
      { ...zeroDeductions, federalAndStateTaxWithholding: 900 },
    );

    expect(derived.recipientNetMonthlyIncomeCents).toBe(0);
    expect(derived.derivedMonthlyNeedCents).toBe(100_000);
  });

  it("counts every gross income category and every statutory deduction", () => {
    const derived = deriveReasonableMonthlyNeed(
      { ...zeroExpenses, housingMonthly: 10_000 },
      { ...zeroIncome, wages: 1000, rentalIncome: 500, disabilityBenefits: 250 },
      { ...zeroDeductions, socialSecurityAndMedicareTax: 100, spousalSupportPaidUnderPriorOrder: 150 },
    );

    expect(derived.recipientNetMonthlyIncomeCents).toBe(150_000);
  });

  it("ignores union dues, which are not an allowable statutory deduction", () => {
    const derived = deriveReasonableMonthlyNeed(
      { ...zeroExpenses, housingMonthly: 5000 },
      { ...zeroIncome, wages: 2000 },
      { ...zeroDeductions, unionDues: 500 },
    );

    expect(derived.recipientNetMonthlyIncomeCents).toBe(200_000);
  });
});

describe("resolveReasonableMonthlyNeed", () => {
  it("prefers a positive user-entered figure over the derived shortfall", () => {
    const resolved = resolveReasonableMonthlyNeed(
      1200,
      { ...zeroExpenses, housingMonthly: 3000 },
      zeroIncome,
      zeroDeductions,
    );

    expect(resolved.basis).toBe("user-entered");
    expect(resolved.monthlyNeedCents).toBe(120_000);
    expect(resolved.derivedMonthlyNeedCents).toBe(300_000);
  });

  it("falls back to the derived shortfall when no figure was entered", () => {
    const resolved = resolveReasonableMonthlyNeed(
      0,
      { ...zeroExpenses, housingMonthly: 2500 },
      { ...zeroIncome, wages: 1000 },
      zeroDeductions,
    );

    expect(resolved.basis).toBe("derived-from-budget");
    expect(resolved.monthlyNeedCents).toBe(150_000);
  });

  it("never returns a negative need", () => {
    const resolved = resolveReasonableMonthlyNeed(0, zeroExpenses, { ...zeroIncome, wages: 9000 }, zeroDeductions);

    expect(resolved.monthlyNeedCents).toBe(0);
  });
});
