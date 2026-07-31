/**
 * Public barrel for the versioned, pure family-law rules engine.
 *
 * Importing this module registers all known jurisdiction rulesets (side
 * effect of importing `./florida`) so `listRulesets()`/`getRuleset()` are
 * populated. Consumers that only need a single calculation can instead
 * import directly from `./florida/childSupport` or `./florida/alimony` to
 * avoid pulling in unrelated rulesets.
 */
export * from "./confirmedFact";
export * from "./money";
export * from "./dateMath";
export * from "./types";
export * from "./registry";

import "./florida";
export * from "./florida";
