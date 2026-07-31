/**
 * Lump-sum settlement modelling.
 *
 * This module lives OUTSIDE `src/domain/rules/` on purpose. Everything in
 * the rules engine is grounded in statutory text. Nothing here is.
 *
 * Florida expressly permits alimony to be paid "periodic or lump sum"
 * (Fla. Stat. §61.08(1)(a)) and permits equitable distribution to be paid as
 * a lump sum or in installments, where the court "may require a reasonable
 * rate of interest or may otherwise recognize the time value of the money"
 * (Fla. Stat. §61.075(10)). But the statute fixes NO rate and supplies NO
 * present-value formula. Any single lump-sum figure is therefore a financial
 * modelling assumption, not a legal result.
 *
 * Two consequences are enforced by the design below:
 *
 *  1. The discount rate is a required, explicit input. There is no default,
 *     because a default would look like a legal standard.
 *  2. Results are always produced across a RANGE of rates, so the sensitivity
 *     of the figure to an unlegislated assumption is visible rather than
 *     buried.
 */

import { addCents, cents, roundHalfUp, type Cents } from "@/domain/rules/money";

/** Discount rates are integer basis points: 500 == 5.00% per year. */
export type BasisPoints = number;

export const MIN_DISCOUNT_RATE_BPS = 0;
export const MAX_DISCOUNT_RATE_BPS = 2_000;

export interface LumpSumInput {
  /** Monthly periodic payment being converted. */
  readonly monthlyAmountCents: Cents;
  /** Number of monthly payments. Typically the durational alimony term. */
  readonly numberOfMonths: number;
  /**
   * Annual discount rate in basis points. Required and unlegislated: it
   * reflects the parties' own assumption about the time value of money.
   */
  readonly annualDiscountRateBps: BasisPoints;
}

export interface LumpSumScenario {
  readonly annualDiscountRateBps: BasisPoints;
  /** Present value of the payment stream at this rate. */
  readonly presentValueCents: Cents;
  /**
   * Simple sum of the payments, undiscounted. Shown alongside the present
   * value so the effect of discounting is explicit rather than implied.
   */
  readonly undiscountedTotalCents: Cents;
  /** undiscountedTotal - presentValue. Zero when the rate is zero. */
  readonly discountAmountCents: Cents;
}

export interface LumpSumModel {
  readonly input: LumpSumInput;
  /** The scenario at the rate the user chose. */
  readonly selected: LumpSumScenario;
  /** Sensitivity band around the selected rate, ascending by rate. */
  readonly range: readonly LumpSumScenario[];
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

export class LumpSumInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LumpSumInputError";
  }
}

function assertValidInput(input: LumpSumInput): void {
  if (!Number.isInteger(input.numberOfMonths) || input.numberOfMonths < 0) {
    throw new LumpSumInputError("The number of months must be a non-negative whole number.");
  }
  if (input.numberOfMonths > 1_200) {
    throw new LumpSumInputError("The number of months must not exceed 1200 (100 years).");
  }
  if (input.monthlyAmountCents < 0) {
    throw new LumpSumInputError("The monthly amount must not be negative.");
  }
  if (
    !Number.isInteger(input.annualDiscountRateBps) ||
    input.annualDiscountRateBps < MIN_DISCOUNT_RATE_BPS ||
    input.annualDiscountRateBps > MAX_DISCOUNT_RATE_BPS
  ) {
    throw new LumpSumInputError(
      `The annual discount rate must be a whole number of basis points between ${MIN_DISCOUNT_RATE_BPS} and ${MAX_DISCOUNT_RATE_BPS}.`,
    );
  }
}

/**
 * Present value of an ordinary annuity: payments are treated as arriving at
 * the END of each month, which matches how support is actually paid.
 *
 *   PV = PMT x (1 - (1 + i)^-n) / i,  where i is the monthly rate
 *
 * At a zero rate the formula is undefined, and the present value is simply
 * the undiscounted sum.
 */
export function presentValueOfMonthlyPayments(
  monthlyAmountCents: Cents,
  numberOfMonths: number,
  annualDiscountRateBps: BasisPoints,
): Cents {
  if (numberOfMonths === 0 || monthlyAmountCents === 0) {
    return cents(0);
  }
  if (annualDiscountRateBps === 0) {
    return cents(monthlyAmountCents * numberOfMonths);
  }

  const monthlyRate = annualDiscountRateBps / 10_000 / 12;
  const factor = (1 - Math.pow(1 + monthlyRate, -numberOfMonths)) / monthlyRate;
  return cents(roundHalfUp(monthlyAmountCents * factor));
}

function buildScenario(input: LumpSumInput, rateBps: BasisPoints): LumpSumScenario {
  const presentValueCents = presentValueOfMonthlyPayments(
    input.monthlyAmountCents,
    input.numberOfMonths,
    rateBps,
  );
  const undiscountedTotalCents = cents(input.monthlyAmountCents * input.numberOfMonths);

  return {
    annualDiscountRateBps: rateBps,
    presentValueCents,
    undiscountedTotalCents,
    discountAmountCents: cents(undiscountedTotalCents - presentValueCents),
  };
}

/** Rates used for the sensitivity band, in basis points. */
const SENSITIVITY_RATES_BPS: readonly BasisPoints[] = [0, 200, 300, 400, 500, 600, 800];

/**
 * Converts a monthly payment stream into a lump-sum equivalent, together
 * with a sensitivity band and the disclosures the figure requires.
 */
export function modelLumpSum(input: LumpSumInput): LumpSumModel {
  assertValidInput(input);

  const selected = buildScenario(input, input.annualDiscountRateBps);

  const rates = [...new Set([...SENSITIVITY_RATES_BPS, input.annualDiscountRateBps])].sort((a, b) => a - b);
  const range = rates.map((rate) => buildScenario(input, rate));

  const assumptions = [
    "Payments are treated as made at the end of each month for the full term, with no early termination.",
    "The discount rate you chose is not set by Florida law. Fla. Stat. §61.075(10)(b) lets a court require " +
      "'a reasonable rate of interest' on installment payments but fixes no number, and no statute supplies a " +
      "present-value formula for alimony. This figure is a financial estimate, not a legal result.",
    "No adjustment is made for inflation, investment return, or the risk that payments would not be made.",
  ];

  const warnings = [
    "Periodic alimony normally ends on death or remarriage and can be modified; a lump sum generally cannot. " +
      "That difference has real value to both sides and is not captured in this arithmetic.",
    "Tax treatment differs. Since 2019, alimony under a new order is neither deductible by the payor nor " +
      "taxable to the recipient, while a transfer of property between spouses incident to divorce is generally " +
      "not a taxable event. Whether a payment is characterized as alimony or as equitable distribution can " +
      "change its real cost. Ask a CPA or a Florida family-law attorney.",
    "A lump sum paid from a pre-tax retirement account is not worth its face value, and dividing an employer " +
      "plan generally requires a Qualified Domestic Relations Order.",
  ];

  return { input, selected, range, assumptions, warnings };
}

/**
 * Combines a lump-sum alimony buyout with an equitable-distribution
 * equalizing payment to show a single net transfer between the spouses.
 *
 * Both components are supplied by the caller (the equalizing payment comes
 * from the §61.075 ruleset), so this performs no legal classification of its
 * own — it only adds the two figures and reports the direction of the
 * combined transfer.
 */
export interface CombinedSettlementInput {
  readonly alimonyLumpSumCents: Cents;
  readonly equalizingPaymentCents: Cents;
  /** True when the same spouse owes both components. */
  readonly sameDirection: boolean;
}

export interface CombinedSettlement {
  readonly totalTransferCents: Cents;
  readonly componentsOffset: boolean;
}

export function combineSettlementComponents(input: CombinedSettlementInput): CombinedSettlement {
  if (input.sameDirection) {
    return {
      totalTransferCents: addCents(input.alimonyLumpSumCents, input.equalizingPaymentCents),
      componentsOffset: false,
    };
  }

  // Opposite directions net against each other.
  return {
    totalTransferCents: cents(Math.abs(input.alimonyLumpSumCents - input.equalizingPaymentCents)),
    componentsOffset: true,
  };
}
