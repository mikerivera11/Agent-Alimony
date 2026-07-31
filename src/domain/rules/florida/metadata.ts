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

export const FLORIDA_EQUITABLE_DISTRIBUTION_STATUTE_CITATION = {
  citation: "Fla. Stat. §61.075",
  title: "Equitable distribution of marital assets and liabilities",
  url: "https://www.flsenate.gov/Laws/Statutes/2025/61.075",
} as const;

/**
 * Effective date used for the §61.075 equitable-distribution ruleset. The 2024
 * amendments to §61.075 (which added, among other things, the §61.075(6)(a)1.c
 * coverture-fraction treatment of principal paydown on nonmarital real
 * property) took effect July 1, 2024 and are carried into the 2025 statutory
 * compilation this ruleset implements against. This ruleset does not gate its
 * computation on a petition date the way §61.08 does; the date is recorded as
 * ruleset metadata for provenance only.
 */
export const FLORIDA_EQUITABLE_DISTRIBUTION_EFFECTIVE_DATE = "2024-07-01";
