/**
 * These tests guard the boundary the forms module exists to hold: a worksheet
 * may restate what the rules engine computed and what the person entered, and
 * nothing else. It may not compute, and it may not present itself as a filing.
 */

import { describe, expect, it } from "vitest";

import {
  buildChildSupportWorksheet,
  buildParentingPlanWorksheet,
  CHILD_SUPPORT_GUIDELINES_FORM,
  PARENTING_PLAN_FORM,
} from "@/domain/forms";
import { buildReviewedDraft } from "@/domain/intake";
import { buildPackageViewModel, formatCentsAsDollars } from "@/domain/package";
import type { ChildSupportResult, RuleOutcome } from "@/domain/rules";
import { buildWorksheet } from "@/server/package/worksheets";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

const CITATIONS = [{ citation: "Fla. Stat. \u00a761.30", title: "Child support guidelines" }];

/**
 * Drives the worksheet through the exact path production uses — sample draft,
 * reviewed snapshot, package view model — rather than a hand-written result
 * object. A hand-written fixture can drift from the rule types and still pass,
 * which is precisely the disagreement this test exists to catch.
 */
function realCase() {
  const reviewed = buildReviewedDraft(createSampleDraft());
  const viewModel = buildPackageViewModel(reviewed);
  return { reviewed, viewModel };
}

function buildCs(outcome: RuleOutcome<ChildSupportResult>) {
  return buildChildSupportWorksheet({
    outcome,
    ruleVersion: "2025",
    effectiveDate: "2025-07-01",
    rulesetId: "florida-child-support-2025",
    citations: CITATIONS,
    generatedAt: "2026-07-31T00:00:00.000Z",
    selfParentId: "parent1",
    childNamesOrInitials: ["A.B."],
    county: "Orange",
  });
}

describe("child support guidelines worksheet", () => {
  it("returns null when support was not calculated, so no page of blanks can look fileable", () => {
    for (const kind of ["not-applicable", "insufficient-data"] as const) {
      expect(buildCs({ kind, reason: "no children" } as unknown as RuleOutcome<ChildSupportResult>)).toBeNull();
    }
  });

  it("shows only figures the rules engine produced", () => {
    const { reviewed, viewModel } = realCase();
    const worksheet = buildWorksheet("child-support-guidelines", viewModel, reviewed);
    expect(worksheet).not.toBeNull();

    const outcome = viewModel.childSupport;
    expect(outcome.kind).toBe("calculated");
    const result = (outcome as Extract<typeof outcome, { kind: "calculated" }>).result;
    const values = worksheet!.lines.map((line) => line.value).filter(Boolean).join(" | ");

    // Every headline figure must be the one the ruleset produced, not a
    // recomputation, so the worksheet can never disagree with the packet.
    expect(values).toContain(formatCentsAsDollars(result.monthlyTransferAmountCents));
    expect(values).toContain(formatCentsAsDollars(result.combinedNetMonthlyIncomeCents));
    expect(values).toContain(formatCentsAsDollars(result.totalMinimumChildSupportNeedCents));
    expect(values).not.toMatch(/NaN|undefined/);
  });

  it("always reports the identifying information it cannot supply", () => {
    const { reviewed, viewModel } = realCase();
    const worksheet = buildWorksheet("child-support-guidelines", viewModel, reviewed);
    expect(worksheet!.gaps.join(" ")).toMatch(/case number/i);
    expect(worksheet!.gaps.join(" ")).toMatch(/legal name/i);
  });
});

describe("parenting plan worksheet", () => {
  const children = { hasChildren: "yes" as const, children: [{ nameOrInitials: "A.B." }] };

  it("returns null when there are no shared minor children", () => {
    expect(
      buildParentingPlanWorksheet({
        parentingPlan: {},
        parentingTime: {},
        children: { hasChildren: "no" },
        generatedAt: "2026-07-31T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("records terms nobody has decided as gaps rather than as answers", () => {
    const worksheet = buildParentingPlanWorksheet({
      parentingPlan: { planStatus: "proposed" },
      parentingTime: {},
      children: children as never,
      generatedAt: "2026-07-31T00:00:00.000Z",
      county: "Orange",
    });

    expect(worksheet).not.toBeNull();
    // An undecided term must never render as an empty value that reads as settled.
    const undecided = worksheet!.lines.filter((line) => line.kind === "input" && line.value === null);
    expect(undecided).toHaveLength(0);
    expect(worksheet!.gaps.length).toBeGreaterThan(1);
  });

  it("states Florida's shared-responsibility default without stating an outcome", () => {
    const worksheet = buildParentingPlanWorksheet({
      parentingPlan: { planStatus: "agreed" },
      parentingTime: {},
      children: children as never,
      generatedAt: "2026-07-31T00:00:00.000Z",
      county: "Orange",
    });
    const notes = worksheet!.lines.filter((line) => line.kind === "note").map((line) => line.explanation).join(" ");
    expect(notes).toMatch(/detrimental/i);
  });
});

describe("official form references", () => {
  it("only exposes a URL and revision for a form whose footer was actually read", () => {
    for (const form of [CHILD_SUPPORT_GUIDELINES_FORM, PARENTING_PLAN_FORM]) {
      if (form.verified) {
        expect(form.revision).toBeTruthy();
        expect(form.url).toContain("flcourts.gov");
      } else {
        // An unverified form must not link anywhere — a guessed URL once served
        // the Dependency Benchbook in place of the Parenting Plan.
        expect(form.url).toBeNull();
        expect(form.revision).toBeNull();
      }
      expect(form.note).not.toBe("");
    }
  });
});
