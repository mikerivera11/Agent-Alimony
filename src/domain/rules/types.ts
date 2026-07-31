/**
 * State-agnostic core types for the rules engine: ruleset metadata,
 * discriminated calculation outcomes, formula-trace steps, and citations.
 * Nothing in this file is Florida-specific — jurisdiction rulesets (e.g.
 * `florida/`) implement against these shapes.
 */

export interface StatutoryCitation {
  readonly citation: string;
  readonly title?: string;
  readonly url?: string;
}

/** One step of a preserved, human-readable calculation trace. */
export interface FormulaStep {
  readonly stepId: string;
  readonly description: string;
  readonly citation?: string;
  readonly values: Readonly<Record<string, string | number | boolean | null>>;
}

/** A confirmed fact the engine needed but was not provided. */
export interface MissingFact {
  readonly factId: string;
  readonly description: string;
}

export type FlagSeverity = "info" | "warning" | "blocking";

/** A deviation factor, dispute, or other non-fatal note attached to a result. */
export interface RuleFlag {
  readonly flagId: string;
  readonly description: string;
  readonly severity: FlagSeverity;
  readonly citation?: string;
}

export interface CalculatedOutcome<TResult> {
  readonly kind: "calculated";
  readonly rulesetId: string;
  readonly result: TResult;
  readonly formulaTrace: readonly FormulaStep[];
  readonly citations: readonly StatutoryCitation[];
  readonly assumptions: readonly string[];
  readonly warnings: readonly RuleFlag[];
}

export interface NeedsInputOutcome {
  readonly kind: "needsInput";
  readonly rulesetId: string;
  readonly missingFacts: readonly MissingFact[];
  readonly message: string;
}

export interface NotImplementedOutcome {
  readonly kind: "notImplemented";
  readonly rulesetId: string;
  readonly reason: string;
  readonly citations: readonly StatutoryCitation[];
}

export interface RequiresProfessionalReviewOutcome {
  readonly kind: "requiresProfessionalReview";
  readonly rulesetId: string;
  readonly reason: string;
  readonly flags: readonly RuleFlag[];
  readonly citations: readonly StatutoryCitation[];
}

export type RuleOutcome<TResult> =
  | CalculatedOutcome<TResult>
  | NeedsInputOutcome
  | NotImplementedOutcome
  | RequiresProfessionalReviewOutcome;

export function calculatedOutcome<TResult>(
  input: Omit<CalculatedOutcome<TResult>, "kind">,
): CalculatedOutcome<TResult> {
  return { kind: "calculated", ...input };
}

export function needsInputOutcome(input: Omit<NeedsInputOutcome, "kind">): NeedsInputOutcome {
  return { kind: "needsInput", ...input };
}

export function notImplementedOutcome(
  input: Omit<NotImplementedOutcome, "kind">,
): NotImplementedOutcome {
  return { kind: "notImplemented", ...input };
}

export function requiresProfessionalReviewOutcome(
  input: Omit<RequiresProfessionalReviewOutcome, "kind">,
): RequiresProfessionalReviewOutcome {
  return { kind: "requiresProfessionalReview", ...input };
}

/** A predicate (question) a ruleset knows how to evaluate against facts. */
export interface PredicateDescriptor {
  readonly predicateId: string;
  readonly description: string;
}

export type RulesetTopic = "child-support" | "alimony" | "equitable-distribution";

export interface RulesetMetadata {
  readonly rulesetId: string;
  readonly jurisdiction: string;
  readonly topic: RulesetTopic;
  readonly statutoryCompilation: string;
  /** ISO date this ruleset's rules first became legally effective. */
  readonly effectiveDate: string;
  /** ISO date, if any, after which this ruleset no longer applies. */
  readonly effectiveEndDate?: string;
  readonly applicability: string;
  readonly citations: readonly StatutoryCitation[];
  readonly supportedPredicates: readonly PredicateDescriptor[];
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
}
