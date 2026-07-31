import { describe, expect, it } from "vitest";

import { getRuleset, listRulesets, registerRuleset, type RulesetRegistration } from "./registry";
import "./florida"; // registers the Florida rulesets as a side effect

function registration(overrides: Partial<RulesetRegistration["metadata"]>): RulesetRegistration {
  return {
    metadata: {
      rulesetId: "test-ruleset",
      jurisdiction: "FL",
      topic: "alimony",
      statutoryCompilation: "2025",
      effectiveDate: "2023-07-01",
      applicability: "test",
      citations: [],
      supportedPredicates: [],
      assumptions: [],
      limitations: [],
      ...overrides,
    },
    calculate: () => {
      throw new Error("not used");
    },
  };
}

describe("ruleset registry", () => {
  it("registers the Florida child support and alimony rulesets with full metadata", () => {
    const rulesets = listRulesets();
    const ids = rulesets.map((r) => r.rulesetId);
    expect(ids).toContain("fl-child-support-61.30");
    expect(ids).toContain("fl-alimony-61.08");
    expect(ids).toContain("fl-equitable-distribution-61.075");

    const equitableDistribution = getRuleset("fl-equitable-distribution-61.075");
    expect(equitableDistribution?.metadata.jurisdiction).toBe("FL");
    expect(equitableDistribution?.metadata.topic).toBe("equitable-distribution");
    expect(equitableDistribution?.metadata.citations.length).toBeGreaterThan(0);
    expect(equitableDistribution?.metadata.supportedPredicates.length).toBeGreaterThan(0);

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

  it("rejects a different version of the law claiming an already-registered id", () => {
    registerRuleset(registration({ rulesetId: "collision-check" }));

    expect(() =>
      registerRuleset(registration({ rulesetId: "collision-check", effectiveDate: "2099-01-01" })),
    ).toThrow(/already registered/);
  });

  it("tolerates re-registering the same ruleset id and law version outside production", () => {
    registerRuleset(registration({ rulesetId: "reload-check" }));

    expect(() => registerRuleset(registration({ rulesetId: "reload-check" }))).not.toThrow();
    expect(getRuleset("reload-check")?.metadata.effectiveDate).toBe("2023-07-01");
  });
});
