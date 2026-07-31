/**
 * Shared Florida-specific constants used by both the child-support and
 * alimony rulesets.
 */

/**
 * Fla. Stat. §61.08(11): "The court shall apply this section to all initial
 * petitions for dissolution of marriage or support unconnected with
 * dissolution of marriage pending or filed on or after July 1, 2023."
 *
 * The 2023 rewrite eliminated permanent alimony and introduced the current
 * short/moderate/long-term duration framework. Petitions filed (or already
 * pending) before this date are governed by a materially different prior
 * version of the statute that this ruleset does not implement.
 */
export const FLORIDA_ALIMONY_CURRENT_LAW_EFFECTIVE_DATE = "2023-07-01";

export const FLORIDA_CHILD_SUPPORT_STATUTE_CITATION = {
  citation: "Fla. Stat. §61.30",
  title: "Child support guidelines; retroactive child support",
  url: "https://www.flsenate.gov/Laws/Statutes/2025/61.30",
} as const;

export const FLORIDA_ALIMONY_STATUTE_CITATION = {
  citation: "Fla. Stat. §61.08",
  title: "Alimony",
  url: "https://www.flsenate.gov/Laws/Statutes/2025/61.08",
} as const;
