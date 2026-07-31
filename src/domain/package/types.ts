import type { MappingIssue } from "@/domain/integration";
import type { LumpSumModel } from "@/domain/finance";
import type {
  AlimonyResult,
  ChildSupportResult,
  ConfirmedFactSource,
  EquitableDistributionResult,
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
  readonly topic: "child-support" | "alimony" | "equitable-distribution";
  readonly title: string;
  readonly description: string;
  readonly figures: Readonly<Record<string, string>>;
}

/**
 * Lump-sum settlement modelling inputs and an illustrative present-value model.
 *
 * The discount rate is NOT set by any Florida statute; it is the user's own
 * financial assumption. `illustrativeRateBps` is a single arbitrary rate used
 * only to populate a printable figure and the sensitivity band — it is never
 * presented as "the" answer, and the interactive results screen recomputes the
 * model live from whatever rate the user enters. `model` is null when there is
 * no periodic alimony stream to convert.
 */
export interface PackageLumpSum {
  readonly available: boolean;
  /** Why a lump-sum model could not be produced, when `available` is false. */
  readonly reason: string | null;
  /** Illustrative monthly alimony amount being converted (the §61.08 ceiling). */
  readonly monthlyAmountCents: number;
  /** Number of monthly payments (durational term, or marriage length as a fallback). */
  readonly numberOfMonths: number;
  /** The arbitrary illustrative rate used for the printable figure. */
  readonly illustrativeRateBps: number;
  readonly model: LumpSumModel | null;
  /** Equalizing payment from the §61.075 distribution (with exclusions applied). */
  readonly equalizingPaymentCents: number;
  readonly equalizingFromSpouse: "a" | "b" | null;
  /** Which spouse would owe the alimony lump sum, expressed as an ED spouse id. */
  readonly alimonyPayorSpouse: "a" | "b" | null;
  readonly partyALabel: string;
  readonly partyBLabel: string;
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
  readonly disclaimer: string;
  readonly confirmedFacts: readonly ConfirmedFactEntry[];
  readonly missingOrUnsupported: readonly MappingIssue[];
  readonly sources: readonly StatutoryCitation[];
  readonly childSupport: RuleOutcome<ChildSupportResult>;
  readonly alimony: RuleOutcome<AlimonyResult>;
  readonly equitableDistribution: RuleOutcome<EquitableDistributionResult>;
  readonly lumpSum: PackageLumpSum;
  readonly assumptions: readonly string[];
  readonly verifications: readonly RulesetVerification[];
  readonly scenarios: readonly PackageScenario[];
}
