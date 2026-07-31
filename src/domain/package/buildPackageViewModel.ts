import {
  mapReviewedDraftToAlimonyInput,
  mapReviewedDraftToChildSupportInput,
  type MappingIssue,
} from "@/domain/integration";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import {
  calculateFloridaAlimony,
  calculateFloridaChildSupport,
  FLORIDA_ALIMONY_METADATA,
  FLORIDA_ALIMONY_RULESET_ID,
  FLORIDA_ALIMONY_STATUTE_CITATION,
  FLORIDA_CHILD_SUPPORT_METADATA,
  FLORIDA_CHILD_SUPPORT_RULESET_ID,
  FLORIDA_CHILD_SUPPORT_SCHEDULE,
  needsInputOutcome,
  type AlimonyResult,
  type ChildSupportResult,
  type NeedsInputOutcome,
  type RuleOutcome,
} from "@/domain/rules";

import { buildConfirmedFactEntries } from "./confirmedFacts";
import { PACKAGE_DISCLAIMER } from "./disclaimer";
import { buildPackageScenarios } from "./scenarios";
import type { PackageViewModel, RulesetVerification } from "./types";

/**
 * Converts a mapper failure into the same `RuleOutcome` shape a ruleset
 * itself would return for missing input, so the UI/PDF can render both
 * mapper-level gaps and ruleset-level gaps identically.
 */
function toNeedsInputOutcome(
  rulesetId: string,
  message: string,
  issues: readonly MappingIssue[],
): NeedsInputOutcome {
  const blocking = issues.filter((issue) => issue.severity === "blocking");
  const source = blocking.length > 0 ? blocking : issues;
  return needsInputOutcome({
    rulesetId,
    message,
    missingFacts: source.map((issue) => ({ factId: issue.code, description: issue.message })),
  });
}

function dedupeAssumptions(assumptions: readonly string[]): string[] {
  return Array.from(new Set(assumptions));
}

/**
 * Builds the complete, transparent package view model for a fully-reviewed
 * intake snapshot: mapped confirmed facts, both rules outcomes (with their
 * full formula traces), every gap or unsupported item, assumptions,
 * citations, ruleset verification dates, illustrative scenarios, and the
 * attorney-review disclaimer. Pure function — no I/O, no network, no
 * persistence. Safe to call on the client (for the results page) or on the
 * server (to regenerate a trusted view model for the PDF endpoint).
 */
export function buildPackageViewModel(reviewed: ReviewedIntakeDraft): PackageViewModel {
  const childSupportMapping = mapReviewedDraftToChildSupportInput(reviewed);
  const alimonyMapping = mapReviewedDraftToAlimonyInput(reviewed);

  const childSupport: RuleOutcome<ChildSupportResult> =
    childSupportMapping.kind === "mapped"
      ? calculateFloridaChildSupport(childSupportMapping.value)
      : toNeedsInputOutcome(
          FLORIDA_CHILD_SUPPORT_RULESET_ID,
          "Child support could not be calculated from the confirmed facts currently on file.",
          childSupportMapping.issues,
        );

  const alimony: RuleOutcome<AlimonyResult> =
    alimonyMapping.kind === "mapped"
      ? calculateFloridaAlimony(alimonyMapping.value)
      : toNeedsInputOutcome(
          FLORIDA_ALIMONY_RULESET_ID,
          "Alimony could not be calculated from the confirmed facts currently on file.",
          alimonyMapping.issues,
        );

  const missingOrUnsupported: MappingIssue[] = [...childSupportMapping.issues, ...alimonyMapping.issues];

  const assumptions = dedupeAssumptions([
    ...FLORIDA_CHILD_SUPPORT_METADATA.assumptions,
    ...FLORIDA_ALIMONY_METADATA.assumptions,
    ...(childSupport.kind === "calculated" ? childSupport.assumptions : []),
    ...(alimony.kind === "calculated" ? alimony.assumptions : []),
    "Every intake dollar amount is converted to integer cents before any calculation, and every rounding step " +
      "is explicit and deterministic (round-half-up).",
  ]);

  const sourcesByCitation = new Map(
    [...FLORIDA_CHILD_SUPPORT_METADATA.citations, ...FLORIDA_ALIMONY_METADATA.citations].map((citation) => [
      citation.citation,
      citation,
    ]),
  );

  const verifications: RulesetVerification[] = [
    {
      rulesetId: FLORIDA_CHILD_SUPPORT_METADATA.rulesetId,
      jurisdiction: FLORIDA_CHILD_SUPPORT_METADATA.jurisdiction,
      topic: FLORIDA_CHILD_SUPPORT_METADATA.topic,
      statutoryCompilation: FLORIDA_CHILD_SUPPORT_METADATA.statutoryCompilation,
      effectiveDate: FLORIDA_CHILD_SUPPORT_METADATA.effectiveDate,
      sourceVerifiedAt: FLORIDA_CHILD_SUPPORT_SCHEDULE.sourceVerifiedAt,
      sourceUrl: FLORIDA_CHILD_SUPPORT_SCHEDULE.source.url,
    },
    {
      rulesetId: FLORIDA_ALIMONY_METADATA.rulesetId,
      jurisdiction: FLORIDA_ALIMONY_METADATA.jurisdiction,
      topic: FLORIDA_ALIMONY_METADATA.topic,
      statutoryCompilation: FLORIDA_ALIMONY_METADATA.statutoryCompilation,
      effectiveDate: FLORIDA_ALIMONY_METADATA.effectiveDate,
      sourceVerifiedAt: "2026-07-30",
      sourceUrl: FLORIDA_ALIMONY_STATUTE_CITATION.url,
    },
  ];

  return {
    draftId: reviewed.draftId,
    generatedAt: new Date().toISOString(),
    isDemo: reviewed.isDemo,
    disclaimer: PACKAGE_DISCLAIMER,
    confirmedFacts: buildConfirmedFactEntries(reviewed),
    missingOrUnsupported,
    sources: Array.from(sourcesByCitation.values()),
    childSupport,
    alimony,
    assumptions,
    verifications,
    scenarios: buildPackageScenarios(childSupport, alimony),
  };
}
