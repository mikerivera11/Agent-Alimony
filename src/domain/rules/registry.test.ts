import { describe, expect, it } from "vitest";

import { getRuleset, listRulesets } from "./registry";
import "./florida"; // registers the Florida rulesets as a side effect

describe("ruleset registry", () => {
  it("registers the Florida child support and alimony rulesets with full metadata", () => {
    const rulesets = listRulesets();
    const ids = rulesets.map((r) => r.rulesetId);
    expect(ids).toContain("fl-child-support-61.30");
    expect(ids).toContain("fl-alimony-61.08");

    const childSupport = getRuleset("fl-child-support-61.30");
    expect(childSupport?.metadata.jurisdiction).toBe("FL");
    expect(childSupport?.metadata.topic).toBe("child-support");
    expect(childSupport?.metadata.citations.length).toBeGreaterThan(0);
    expect(childSupport?.metadata.supportedPredicates.length).toBeGreaterThan(0);

    const alimony = getRuleset("fl-alimony-61.08");
    expect(alimony?.metadata.jurisdiction).toBe("FL");
    expect(alimony?.metadata.topic).toBe("alimony");
    expect(alimony?.metadata.effectiveDate).toBe("2023-07-01");
  });

  it("returns undefined for an unknown ruleset id", () => {
    expect(getRuleset("does-not-exist")).toBeUndefined();
  });
});
