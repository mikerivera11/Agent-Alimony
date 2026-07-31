import { registerRuleset } from "../../registry";
import { FLORIDA_CHILD_SUPPORT_STATUTE_CITATION } from "../metadata";
import { calculateFloridaChildSupport, FLORIDA_CHILD_SUPPORT_RULESET_ID } from "./calculate";
import { FLORIDA_CHILD_SUPPORT_SCHEDULE } from "./schedule";
import type { RulesetMetadata } from "../../types";

export const FLORIDA_CHILD_SUPPORT_METADATA: RulesetMetadata = {
  rulesetId: FLORIDA_CHILD_SUPPORT_RULESET_ID,
  jurisdiction: "FL",
  topic: "child-support",
  statutoryCompilation: FLORIDA_CHILD_SUPPORT_SCHEDULE.statuteCompilation,
  effectiveDate: "2023-07-01",
  applicability:
    "Florida child support proceedings for 1-6 children under Fla. Stat. §61.30, using the generated 2025 statutory guidelines schedule.",
  citations: [FLORIDA_CHILD_SUPPORT_STATUTE_CITATION],
  supportedPredicates: [
    { predicateId: "combinedNetIncomeWithinSchedule", description: "Combined net monthly income is $800.00-$10,000.00." },
    { predicateId: "combinedNetIncomeAboveSchedule", description: "Combined net monthly income exceeds $10,000.00." },
    { predicateId: "substantialTimeSharing", description: "Both parents exercise at least 20% of overnights." },
    { predicateId: "socialSecurityChildBenefitCredit", description: "A Social Security child benefit is attributable to the calculated obligor." },
  ],
  assumptions: [
    "Table-row selection normalizes to the $50 statutory bracket floor rather than interpolating between rows.",
    "Child care and health-insurance add-ons are added at full confirmed cost; no tax-credit reduction is applied.",
  ],
  limitations: [
    "Does not compute the below-$800 / HHS poverty-guideline obligor branch under §61.30(6)(a); returns notImplemented instead.",
    "Supports 1-6 children only; more than six children returns notImplemented.",
    "The >55% of gross income deviation factor is surfaced as a warning, never as a clamp on the calculated amount.",
  ],
};

registerRuleset({
  metadata: FLORIDA_CHILD_SUPPORT_METADATA,
  calculate: calculateFloridaChildSupport,
});

export { calculateFloridaChildSupport, FLORIDA_CHILD_SUPPORT_RULESET_ID } from "./calculate";
export * from "./types";
export * from "./schedule";
