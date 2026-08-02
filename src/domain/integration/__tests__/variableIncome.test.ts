/**
 * Variable pay — bonuses, commissions, vesting equity, and gains from selling
 * stock — under Fla. Stat. §61.30(2)(a).
 *
 * The load-bearing rule here is §61.30(2)(a)14: gains from dealings in
 * property count "unless the gain is nonrecurring". A one-time sale is not
 * income, and quietly counting it would inflate both the child support
 * transfer and the alimony cap.
 */

import { describe, expect, it } from "vitest";

import { buildReviewedDraft, incomeSchema, type PersonIncome } from "@/domain/intake";
import { buildPackageViewModel } from "@/domain/package";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { sumGrossIncomeDollars } from "../childSupportMapper";

const ZERO: PersonIncome = {
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

describe("variable pay in monthly gross income", () => {
  it("counts bonuses, commissions, and vesting equity as income", () => {
    // §61.30(2)(a)2. — bonuses, commissions and similar payments are income.
    expect(sumGrossIncomeDollars({ ...ZERO, bonusesAndCommissions: 1_500 })).toBe(1_500);
    expect(sumGrossIncomeDollars({ ...ZERO, equityCompensation: 2_000 })).toBe(2_000);
    expect(sumGrossIncomeDollars({ ...ZERO, investmentIncome: 300 })).toBe(300);
  });

  it("counts recurring gains but excludes nonrecurring gains", () => {
    // §61.30(2)(a)14. draws the line at whether the gain recurs.
    expect(sumGrossIncomeDollars({ ...ZERO, recurringCapitalGains: 900 })).toBe(900);
    expect(sumGrossIncomeDollars({ ...ZERO, nonrecurringGains: 50_000 })).toBe(0);
  });

  it("does not let a nonrecurring gain change the total no matter how large", () => {
    const base = { ...ZERO, wages: 6_000, bonusesAndCommissions: 1_000 };
    expect(sumGrossIncomeDollars({ ...base, nonrecurringGains: 250_000 })).toBe(
      sumGrossIncomeDollars(base),
    );
  });

  it("adds every counted category exactly once", () => {
    const person: PersonIncome = {
      wages: 6_000,
      selfEmploymentIncome: 500,
      bonusesAndCommissions: 1_200,
      equityCompensation: 2_500,
      investmentIncome: 300,
      recurringCapitalGains: 400,
      nonrecurringGains: 99_999,
      rentalIncome: 700,
      retirementOrPensionIncome: 250,
      unemploymentBenefits: 100,
      disabilityBenefits: 150,
      otherIncome: 50,
    };
    // Everything above except the nonrecurring gain.
    expect(sumGrossIncomeDollars(person)).toBe(6_000 + 500 + 1_200 + 2_500 + 300 + 400 + 700 + 250 + 100 + 150 + 50);
  });
});

describe("drafts saved before these fields existed", () => {
  /**
   * Drafts live in browser localStorage as raw JSON and are never migrated, so
   * a draft written before these fields shipped simply has no key for them.
   * They must default rather than fail — and above all must not reach the
   * money arithmetic as NaN.
   */
  const legacyPerson = {
    wages: 6_000,
    selfEmploymentIncome: 0,
    bonusesAndCommissions: 200,
    investmentIncome: 50,
    rentalIncome: 0,
    retirementOrPensionIncome: 0,
    unemploymentBenefits: 0,
    disabilityBenefits: 0,
    otherIncome: 0,
  };

  it("parses and defaults the new categories to zero", () => {
    const parsed = incomeSchema.parse({ self: legacyPerson, spouse: legacyPerson });

    expect(parsed.self.equityCompensation).toBe(0);
    expect(parsed.self.recurringCapitalGains).toBe(0);
    expect(parsed.self.nonrecurringGains).toBe(0);
  });

  it("produces a finite total for a legacy draft", () => {
    const parsed = incomeSchema.parse({ self: legacyPerson, spouse: legacyPerson });
    const total = sumGrossIncomeDollars(parsed.self);

    expect(Number.isNaN(total)).toBe(false);
    expect(total).toBe(6_250);
  });
});

describe("variable pay reaches both calculations", () => {
  /**
   * §61.08(8)(c) says alimony net income "shall be calculated in conformity
   * with s. 61.30(2) and (3)". So a commission is not allowed to raise child
   * support while leaving the alimony cap untouched, or vice versa. This test
   * drives the real draft -> package pipeline to prove both move together.
   */
  function packageFor(mutate: (draft: ReturnType<typeof createSampleDraft>) => void) {
    const draft = createSampleDraft();
    mutate(draft);
    return buildPackageViewModel(buildReviewedDraft(draft));
  }

  function figures(vm: ReturnType<typeof buildPackageViewModel>) {
    const cs = vm.childSupport.kind === "calculated" ? vm.childSupport.result.monthlyTransferAmountCents : null;
    // The 35% figure IS the §61.08(8)(c) cap, computed off net income that the
    // same statute directs be figured in conformity with §61.30(2) and (3).
    const al =
      vm.alimony.kind === "calculated"
        ? vm.alimony.result.amountCeiling.thirtyFivePercentOfIncomeDifferenceCents
        : null;
    return { cs, al };
  }

  it("a commission raises both the child support transfer and the alimony ceiling", () => {
    const base = figures(packageFor(() => {}));
    const withCommission = figures(
      packageFor((draft) => {
        draft.data.income!.self!.bonusesAndCommissions = 4_000;
      }),
    );

    // Both must actually have been calculated, or this test proves nothing.
    expect(base.cs).not.toBeNull();
    expect(base.al).not.toBeNull();

    expect(withCommission.cs).not.toBe(base.cs);
    expect(withCommission.al).not.toBe(base.al);
  });

  it("a nonrecurring gain changes neither", () => {
    const base = figures(packageFor(() => {}));
    const withGain = figures(
      packageFor((draft) => {
        draft.data.income!.self!.nonrecurringGains = 250_000;
      }),
    );

    expect(base.cs).not.toBeNull();
    expect(base.al).not.toBeNull();

    expect(withGain.cs).toBe(base.cs);
    expect(withGain.al).toBe(base.al);
  });
});
