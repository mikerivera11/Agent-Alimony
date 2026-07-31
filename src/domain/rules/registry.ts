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

/**
 * Registers a ruleset, refusing to let two *different* rulesets claim the
 * same id — that would silently change which formula runs for a jurisdiction.
 *
 * In development the module graph is re-evaluated on hot reload, which
 * produces a fresh registration object for the very same ruleset id and
 * version. That is not a collision, so outside production a re-registration
 * of the same id and same law version (effective date + statutory
 * compilation) replaces the previous entry instead of throwing. Production
 * keeps the strict check, as does any genuine id collision between two
 * different versions of the law.
 */
export function registerRuleset<TInput, TResult>(
  registration: RulesetRegistration<TInput, TResult>,
): void {
  const existing = registry.get(registration.metadata.rulesetId);
  const isSameRegistration = existing === (registration as RulesetRegistration);
  const isHotReloadOfSameRuleset =
    process.env.NODE_ENV !== "production" &&
    existing !== undefined &&
    existing.metadata.effectiveDate === registration.metadata.effectiveDate &&
    existing.metadata.statutoryCompilation === registration.metadata.statutoryCompilation;

  if (existing && !isSameRegistration && !isHotReloadOfSameRuleset) {
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
