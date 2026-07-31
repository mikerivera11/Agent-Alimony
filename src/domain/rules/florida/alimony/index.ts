import { registerRuleset } from "../../registry";
import { FLORIDA_ALIMONY_CURRENT_LAW_EFFECTIVE_DATE, FLORIDA_ALIMONY_STATUTE_CITATION } from "../metadata";
import {
  ALIMONY_SUBSECTION_THREE_FACTORS,
  calculateFloridaAlimony,
  FLORIDA_ALIMONY_RULESET_ID,
} from "./calculate";
import type { RulesetMetadata } from "../../types";

export const FLORIDA_ALIMONY_METADATA: RulesetMetadata = {
  rulesetId: FLORIDA_ALIMONY_RULESET_ID,
  jurisdiction: "FL",
  topic: "alimony",
  statutoryCompilation: "2025",
  effectiveDate: FLORIDA_ALIMONY_CURRENT_LAW_EFFECTIVE_DATE,
  applicability:
    "Florida alimony determinations under the current (post-2023 reform) Fla. Stat. §61.08, for petitions pending or filed on or after 2023-07-01.",
  citations: [FLORIDA_ALIMONY_STATUTE_CITATION],
  supportedPredicates: [
    { predicateId: "petitionOnOrAfterCurrentLawDate", description: "Petition filing date is on or after 2023-07-01." },
    { predicateId: "marriageDurationCategory", description: "Classifies the marriage as short/moderate/long-term." },
    { predicateId: "durationalAlimonyAvailable", description: "Marriage duration is at least 3 years." },
    ...ALIMONY_SUBSECTION_THREE_FACTORS.map((factor) => ({
      predicateId: `subsectionThreeFactor.${factor.factorId}`,
      description: factor.description,
    })),
  ],
  assumptions: [
    "Marriage duration is measured in whole elapsed calendar months from marriage date to petition filing date.",
    "Durational alimony's percentage ceiling applies to the exact marriage length, not the category's typical range.",
  ],
  limitations: [
    "Petitions filed before 2023-07-01 are governed by a prior statute this ruleset does not implement; returns requiresProfessionalReview.",
    "Never returns a recommended award amount or duration — only a transparent 0-to-ceiling range and statutory duration caps.",
    "Does not resolve disputed need or ability-to-pay determinations; returns requiresProfessionalReview.",
  ],
};

registerRuleset({
  metadata: FLORIDA_ALIMONY_METADATA,
  calculate: calculateFloridaAlimony,
});

export { calculateFloridaAlimony, FLORIDA_ALIMONY_RULESET_ID, ALIMONY_SUBSECTION_THREE_FACTORS } from "./calculate";
export * from "./types";
