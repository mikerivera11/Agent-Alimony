/**
 * Typed mapping-issue vocabulary for the intake-to-rules-engine boundary.
 *
 * Mapping a `ReviewedIntakeDraft` onto the rules engine's strict input types
 * sometimes runs into intake data that is ambiguous, missing, or simply not
 * representable without guessing (e.g. Florida's alimony ruleset requires an
 * explicit payor/obligee designation that current intake does not collect).
 * Rather than silently guessing, every mapper in this package returns these
 * typed issues so callers (the package view model, the UI, the PDF) can show
 * exactly what happened and why a number is missing or was excluded.
 */

export type MappingIssueSeverity = "blocking" | "warning" | "info";

export interface MappingIssue {
  /** Stable machine-readable identifier, e.g. "needs-explicit-recipient". */
  readonly code: string;
  /** "blocking" means the calculation could not be produced at all. */
  readonly severity: MappingIssueSeverity;
  /** Plain-language explanation suitable for display to the person and their attorney. */
  readonly message: string;
}

/** A mapper either produces a confirmed-fact-ready value, or it doesn't. */
export interface MappingSuccess<T> {
  readonly kind: "mapped";
  readonly value: T;
  /** Non-blocking notes about ambiguities or conservative choices made while mapping. */
  readonly issues: readonly MappingIssue[];
}

export interface MappingFailure {
  readonly kind: "unmapped";
  /** Always contains at least one issue explaining why mapping did not proceed. */
  readonly issues: readonly MappingIssue[];
}

export type MappingResult<T> = MappingSuccess<T> | MappingFailure;

export function mapped<T>(value: T, issues: readonly MappingIssue[] = []): MappingSuccess<T> {
  return { kind: "mapped", value, issues };
}

export function unmapped(issues: readonly MappingIssue[]): MappingFailure {
  return { kind: "unmapped", issues };
}

/** Converts a whole-dollar (or fractional-dollar) amount into integer cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
