/**
 * Deterministic derivation of the alimony recipient's reasonable monthly need.
 *
 * Fla. Stat. §61.08(2)(a) makes the obligee's actual need a threshold
 * determination, and §61.08(8)(c) caps durational alimony at the lesser of
 * that need and 35% of the parties' net-income difference. Intake collects a
 * monthly living-expense budget and both parties' income, so when the person
 * does not supply their own documented need figure this module computes the
 * shortfall from the numbers they already entered rather than defaulting the
 * need — and therefore the entire ceiling — to $0.
 *
 * This is ordinary arithmetic on user-confirmed intake values. No AI, no
 * inference, and no invented statutory figure: the budget total and the
 * recipient's net income are both reported back so the subtraction can be
 * checked by hand.
 */
import type { HouseholdExpenses, PersonDeductions, PersonIncome } from "@/domain/intake";

import { mapStatutoryDeductions, sumGrossIncomeDollars } from "./childSupportMapper";
import { dollarsToCents } from "./mappingIssue";

/** Where the reasonable-need figure used in the calculation came from. */
export type ReasonableNeedBasis = "user-entered" | "derived-from-budget";

export interface DerivedReasonableNeed {
  /** Total monthly living expenses entered on the household-expenses topic. */
  readonly monthlyLivingExpensesCents: number;
  /** Recipient's gross monthly income less the statutory deductions. */
  readonly recipientNetMonthlyIncomeCents: number;
  /** Expenses less net income, floored at zero. */
  readonly derivedMonthlyNeedCents: number;
}

export interface ResolvedReasonableNeed extends DerivedReasonableNeed {
  /** The figure actually handed to the rules engine, in cents. */
  readonly monthlyNeedCents: number;
  readonly basis: ReasonableNeedBasis;
}

/** Sums every monthly living-expense category intake collects. */
export function sumMonthlyHouseholdExpensesDollars(expenses: HouseholdExpenses): number {
  return (
    expenses.housingMonthly +
    expenses.utilitiesMonthly +
    expenses.foodMonthly +
    expenses.transportationMonthly +
    expenses.insuranceMonthly +
    expenses.minimumDebtPaymentsMonthly +
    expenses.otherMonthlyExpenses
  );
}

function sumStatutoryDeductionCents(deductions: PersonDeductions): number {
  const mapped = mapStatutoryDeductions(deductions);
  return (
    mapped.federalStateLocalIncomeTaxCents +
    mapped.ficaOrSelfEmploymentTaxCents +
    mapped.mandatoryRetirementCents +
    mapped.healthInsurancePremiumSelfOnlyCents +
    mapped.courtOrderedSupportForOtherChildrenPaidCents +
    mapped.spousalSupportPaidUnderPriorOrderCents
  );
}

/**
 * Computes the recipient's monthly budget shortfall: the household's monthly
 * living expenses less the recipient's own net monthly income, floored at $0.
 */
export function deriveReasonableMonthlyNeed(
  householdExpenses: HouseholdExpenses,
  recipientIncome: PersonIncome,
  recipientDeductions: PersonDeductions,
): DerivedReasonableNeed {
  const monthlyLivingExpensesCents = dollarsToCents(sumMonthlyHouseholdExpensesDollars(householdExpenses));
  const grossCents = dollarsToCents(sumGrossIncomeDollars(recipientIncome));
  const recipientNetMonthlyIncomeCents = Math.max(0, grossCents - sumStatutoryDeductionCents(recipientDeductions));
  const derivedMonthlyNeedCents = Math.max(0, monthlyLivingExpensesCents - recipientNetMonthlyIncomeCents);

  return { monthlyLivingExpensesCents, recipientNetMonthlyIncomeCents, derivedMonthlyNeedCents };
}

/**
 * Chooses between the person's own documented need figure and the derived
 * budget shortfall. A positive user-entered figure always wins; the derived
 * shortfall is used only when no documented figure was supplied.
 */
export function resolveReasonableMonthlyNeed(
  userEnteredMonthlyNeedDollars: number,
  householdExpenses: HouseholdExpenses,
  recipientIncome: PersonIncome,
  recipientDeductions: PersonDeductions,
): ResolvedReasonableNeed {
  const derived = deriveReasonableMonthlyNeed(householdExpenses, recipientIncome, recipientDeductions);
  const userEnteredCents = dollarsToCents(userEnteredMonthlyNeedDollars);

  if (userEnteredCents > 0) {
    return { ...derived, monthlyNeedCents: userEnteredCents, basis: "user-entered" };
  }

  return { ...derived, monthlyNeedCents: derived.derivedMonthlyNeedCents, basis: "derived-from-budget" };
}
