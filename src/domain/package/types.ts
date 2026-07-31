import type { MappingIssue } from "@/domain/integration";
import type {
  AlimonyResult,
  ChildSupportResult,
  ConfirmedFactSource,
  RuleOutcome,
  StatutoryCitation,
} from "@/domain/rules";

/** A single human-readable confirmed fact, tied back to its provenance. */
export interface ConfirmedFactEntry {
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly label: string;
  readonly value: string;
  readonly provenance: ConfirmedFactSource;
}

/** When a jurisdiction's rules/source data were last checked against their authoritative origin. */
export interface RulesetVerification {
  readonly rulesetId: string;
  readonly jurisdiction: string;
  readonly topic: string;
  readonly statutoryCompilation: string;
  readonly effectiveDate: string;
  readonly sourceVerifiedAt: string;
  readonly sourceUrl?: string;
}

/** An illustrative, non-binding what-if breakdown surfaced alongside the raw outcome. */
export interface PackageScenario {
  readonly scenarioId: string;
  readonly topic: "child-support" | "alimony";
  readonly title: string;
  readonly description: string;
  readonly figures: Readonly<Record<string, string>>;
}

/**
 * The full, transparent package view model: every confirmed fact that fed
 * the calculations, every gap or unsupported item, both rules outcomes with
 * their complete formula traces, the assumptions and citations behind them,
 * and the disclaimer that must accompany all of it. Nothing in this shape
 * is ever a recommendation or a binding figure — see `disclaimer`.
 */
export interface PackageViewModel {
  readonly draftId: string;
  readonly generatedAt: string;
  readonly isDemo: boolean;
  readonly disclaimer: string;
  readonly confirmedFacts: readonly ConfirmedFactEntry[];
  readonly missingOrUnsupported: readonly MappingIssue[];
  readonly sources: readonly StatutoryCitation[];
  readonly childSupport: RuleOutcome<ChildSupportResult>;
  readonly alimony: RuleOutcome<AlimonyResult>;
  readonly assumptions: readonly string[];
  readonly verifications: readonly RulesetVerification[];
  readonly scenarios: readonly PackageScenario[];
}
