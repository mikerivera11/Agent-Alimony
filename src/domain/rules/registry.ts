/**
 * A minimal, in-memory ruleset registry. Jurisdiction packages (e.g.
 * `florida/childSupport`, `florida/alimony`) register themselves here so
 * that generic tooling can discover "what rulesets exist" and their
 * metadata (citations, effective dates, supported predicates, etc.) without
 * hard-coding jurisdiction-specific imports.
 */

import type { ConfirmedFact } from "./confirmedFact";
import type { RuleOutcome, RulesetMetadata } from "./types";

export interface RulesetRegistration<TInput = unknown, TResult = unknown> {
  readonly metadata: RulesetMetadata;
  readonly calculate: (input: ConfirmedFact<TInput>) => RuleOutcome<TResult>;
}

const registry = new Map<string, RulesetRegistration>();

export function registerRuleset<TInput, TResult>(
  registration: RulesetRegistration<TInput, TResult>,
): void {
  const existing = registry.get(registration.metadata.rulesetId);
  if (existing && existing !== (registration as RulesetRegistration)) {
    throw new Error(`Ruleset already registered: ${registration.metadata.rulesetId}`);
  }
  registry.set(registration.metadata.rulesetId, registration as RulesetRegistration);
}

export function getRuleset(rulesetId: string): RulesetRegistration | undefined {
  return registry.get(rulesetId);
}

export function listRulesets(): readonly RulesetMetadata[] {
  return Array.from(registry.values()).map((registration) => registration.metadata);
}

/** Test-only helper to reset registry state between isolated test runs. */
export function clearRegistryForTesting(): void {
  registry.clear();
}
