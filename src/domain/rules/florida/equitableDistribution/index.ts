import { registerRuleset } from "../../registry";
import {
  FLORIDA_EQUITABLE_DISTRIBUTION_EFFECTIVE_DATE,
  FLORIDA_EQUITABLE_DISTRIBUTION_STATUTE_CITATION,
} from "../metadata";
import {
  calculateFloridaEquitableDistribution,
  EQUITABLE_DISTRIBUTION_FACTORS,
  FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
} from "./calculate";
import type { RulesetMetadata } from "../../types";

export const FLORIDA_EQUITABLE_DISTRIBUTION_METADATA: RulesetMetadata = {
  rulesetId: FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
  jurisdiction: "FL",
  topic: "equitable-distribution",
  statutoryCompilation: "2025",
  effectiveDate: FLORIDA_EQUITABLE_DISTRIBUTION_EFFECTIVE_DATE,
  applicability:
    "Florida equitable distribution of marital assets and liabilities under Fla. Stat. §61.075, starting from the statutory premise of an equal 50/50 division of the net marital estate.",
  citations: [FLORIDA_EQUITABLE_DISTRIBUTION_STATUTE_CITATION],
  supportedPredicates: [
    { predicateId: "equalDistributionPremise", description: "Applies the §61.075(1) equal-distribution premise to the net marital estate." },
    { predicateId: "nonmaritalSetAside", description: "Sets apart each spouse's nonmarital assets and liabilities under §61.075(6)(b)." },
    { predicateId: "equalizingPayment", description: "Computes the equalizing payment needed to reach an equal split." },
    { predicateId: "writtenAgreementExclusion", description: "Honors §61.075(6)(b)4 exclusions only when a valid written agreement is confirmed." },
    ...EQUITABLE_DISTRIBUTION_FACTORS.map((factor) => ({
      predicateId: `unequalDistributionFactor.${factor.factorId}`,
      description: factor.description,
    })),
  ],
  assumptions: [
    "Distribution begins from an equal 50/50 premise; the tool never predicts an unequal distribution.",
    "Nonmarital property is set apart to its owner and is not part of the equalizing calculation.",
    "Jointly held items are treated as held 50/50 for computing each spouse's current holdings.",
  ],
  limitations: [
    "Does not implement the §61.075(6)(a)1.c coverture-fraction passive-appreciation formula for principal paydown on nonmarital real property; returns requiresProfessionalReview.",
    "Does not value closely held businesses or characterize enterprise goodwill under §61.075(6)(a)1.f; returns requiresProfessionalReview.",
    "Does not predict any unequal (non-50/50) distribution — there is no statutory formula; returns requiresProfessionalReview when one is requested.",
    "Does not compute dissipation offsets under §61.075(1)(i) or resolve disputed classifications; returns requiresProfessionalReview.",
    "Returns the §61.075(1)(a)-(j) factors as display data only and never scores or weights them.",
  ],
};

registerRuleset({
  metadata: FLORIDA_EQUITABLE_DISTRIBUTION_METADATA,
  calculate: calculateFloridaEquitableDistribution,
});

export {
  calculateFloridaEquitableDistribution,
  EQUITABLE_DISTRIBUTION_FACTORS,
  FLORIDA_EQUITABLE_DISTRIBUTION_RULESET_ID,
} from "./calculate";
export * from "./types";
