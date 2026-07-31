/**
 * Builds the exportable worksheets for a reviewed draft.
 *
 * Worksheets are derived from the same `PackageViewModel` the results screen
 * and the estimate packet are built from, never recomputed independently. If
 * they were computed separately, a person could hand an attorney a worksheet
 * whose transfer amount disagreed with the packet in the same envelope, and
 * there would be no way to tell which one was wrong.
 */

import { buildChildSupportWorksheet, buildParentingPlanWorksheet, type FormWorksheet } from "@/domain/forms";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import type { PackageViewModel } from "@/domain/package";
import { FLORIDA_CHILD_SUPPORT_RULESET_ID } from "@/domain/rules";

export type WorksheetId = "child-support-guidelines" | "parenting-plan";

export const WORKSHEET_IDS: readonly WorksheetId[] = ["child-support-guidelines", "parenting-plan"];

/** Filename used for the download, per worksheet. */
export const WORKSHEET_FILENAMES: Record<WorksheetId, string> = {
  "child-support-guidelines": "florida-child-support-guidelines-worksheet.pdf",
  "parenting-plan": "florida-parenting-plan-worksheet.pdf",
};

export function buildWorksheet(
  id: WorksheetId,
  viewModel: PackageViewModel,
  draft: ReviewedIntakeDraft,
): FormWorksheet | null {
  const data = draft.data;

  if (id === "child-support-guidelines") {
    const verification = viewModel.verifications.find(
      (entry) => entry.rulesetId === FLORIDA_CHILD_SUPPORT_RULESET_ID,
    );
    return buildChildSupportWorksheet({
      outcome: viewModel.childSupport,
      rulesetId: FLORIDA_CHILD_SUPPORT_RULESET_ID,
      // The statutory compilation is the closest thing the ruleset carries to a
      // published version, and it is what a reader needs in order to check the
      // figures against the law as it stood.
      ruleVersion: verification?.statutoryCompilation ?? "unknown",
      effectiveDate: verification?.effectiveDate ?? "unknown",
      citations: viewModel.sources,
      generatedAt: viewModel.generatedAt,
      selfParentId: "parent1",
      childNamesOrInitials: (data.children.children ?? [])
        .map((child) => child.nameOrInitials)
        .filter((name): name is string => Boolean(name)),
      county: data.caseBasics.county,
    });
  }

  return buildParentingPlanWorksheet({
    parentingPlan: data.parentingPlan ?? {},
    parentingTime: data.parentingTime ?? {},
    children: data.children,
    generatedAt: viewModel.generatedAt,
    county: data.caseBasics.county,
  });
}
