/**
 * Pure mapper: `ReviewedIntakeDraft` -> Fla. Stat. §61.075 equitable-distribution input.
 *
 * Intake stores each asset/liability in whole/fractional dollars; the rules
 * engine requires integer cents, so every value is converted with
 * `dollarsToCents`. This mapper deliberately:
 *  - carries each itemized asset/liability across verbatim (id, label,
 *    category, type, owner) without inventing or splitting anything;
 *  - forwards a nonmarital §61.075(6)(b) basis ONLY for items actually
 *    classified nonmarital, and returns a typed blocking issue when a
 *    nonmarital item is missing its statutory basis;
 *  - refuses to forward a written-agreement exclusion on a nonmarital item
 *    (nonmarital property is already set apart and has nothing to exclude);
 *  - passes the step-level written-agreement confirmation and the three
 *    claim flags (unequal distribution, dissipation, nonmarital mortgage
 *    paydown) straight through, so the ruleset — not this mapper — decides
 *    whether an exclusion is honored or a professional-review branch applies;
 *  - records the §61.075(7) classification cut-off date as the confirmed
 *    petition/planning date, for the trace only.
 *
 * It never throws and never guesses at data intake does not collect.
 */
import {
  confirmFact,
  type ConfirmedFact,
  type EquitableDistributionInput,
  type EquitableDistributionItem,
} from "@/domain/rules";
import type { AssetDebtItem, ReviewedIntakeDraft } from "@/domain/intake";

import { dollarsToCents, mapped, unmapped, type MappingIssue, type MappingResult } from "./mappingIssue";

function toDomainItem(item: AssetDebtItem): EquitableDistributionItem {
  return {
    id: item.id,
    label: item.label,
    category: item.category,
    type: item.type,
    valueCents: dollarsToCents(item.value),
    classification: item.classification,
    // A basis is only meaningful for — and only accepted on — a nonmarital item.
    nonmaritalBasis: item.classification === "nonmarital" ? item.nonmaritalBasis : undefined,
    owner: item.owner,
    // Guard: never forward an exclusion on a nonmarital item; the ruleset
    // rejects that combination outright.
    excludedByWrittenAgreement:
      item.classification === "nonmarital" ? false : item.excludedByWrittenAgreement === true,
    commingledWithMaritalFunds:
      item.classification === "nonmarital" ? item.commingledWithMaritalFunds === true : false,
  };
}

export function mapReviewedDraftToEquitableDistributionInput(
  reviewed: ReviewedIntakeDraft,
): MappingResult<ConfirmedFact<EquitableDistributionInput>> {
  const { assetsDebts, spouses, caseBasics } = reviewed.data;
  const items = assetsDebts.items;

  // A nonmarital item with no stated §61.075(6)(b) basis cannot be safely set
  // apart. Surface it as a blocking issue rather than guessing a basis.
  const nonmaritalMissingBasis = items.filter(
    (item) => item.classification === "nonmarital" && !item.nonmaritalBasis,
  );
  if (nonmaritalMissingBasis.length > 0) {
    return unmapped(
      nonmaritalMissingBasis.map((item) => ({
        code: `nonmarital-basis-missing.${item.id}`,
        severity: "blocking" as const,
        message:
          `"${item.label}" is marked as separate (nonmarital) property but does not say why under ` +
          "Fla. Stat. §61.075(6)(b). Choose a reason (for example, owned before the marriage, or an " +
          "inheritance/gift) so it can be correctly set apart.",
      })),
    );
  }

  const issues: MappingIssue[] = [];

  if (items.length === 0) {
    issues.push({
      code: "no-itemized-assets-or-debts",
      severity: "info",
      message:
        "No individual assets or debts were itemized, so the equitable-distribution estimate has an empty marital " +
        "estate ($0.00) and no equalizing payment. Add items on the assets & debts topic to see a distribution.",
    });
  }

  const excludedItems = items.filter(
    (item) => item.excludedByWrittenAgreement && item.classification !== "nonmarital",
  );
  if (excludedItems.length > 0 && !assetsDebts.writtenAgreementConfirmed) {
    issues.push({
      code: "exclusions-without-written-agreement",
      severity: "warning",
      message:
        `${excludedItems.length} item(s) are flagged to be excluded from the marital estate, but you have not ` +
        "confirmed that both parties have a valid written agreement to do so. Under Fla. Stat. §61.075(6)(b)4 an " +
        "exclusion is only honored with a written agreement, so those items were kept in the marital estate.",
    });
  }

  const value: EquitableDistributionInput = {
    items: items.map(toDomainItem),
    writtenAgreementConfirmed: assetsDebts.writtenAgreementConfirmed,
    // §61.075(7) classification cut-off date, recorded for the trace only.
    classificationCutoffDateIso: caseBasics.petitionDate,
    partyALabel: spouses.yourNameOrInitials,
    partyBLabel: spouses.spouseNameOrInitials,
    unequalDistributionRequested: assetsDebts.unequalDistributionRequested,
    dissipationClaimPresent: assetsDebts.dissipationClaimPresent,
    nonmaritalMortgagePaydownClaimPresent: assetsDebts.nonmaritalMortgagePaydownClaimPresent,
  };

  return mapped(confirmFact(value, "user-entered", reviewed.reviewedAt), issues);
}

export type EquitableDistributionMappingResult = MappingResult<ConfirmedFact<EquitableDistributionInput>>;
