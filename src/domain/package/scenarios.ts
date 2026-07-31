import type { AlimonyResult, ChildSupportResult, RuleOutcome } from "@/domain/rules";

import { formatCentsAsDollars as formatCents } from "./formatting";
import type { PackageScenario } from "./types";

/**
 * Builds illustrative, non-binding what-if scenarios from whatever outcomes
 * were actually calculated. Never fabricates a scenario for an outcome that
 * was not calculated (`needsInput`/`notImplemented`/`requiresProfessionalReview`).
 */
export function buildPackageScenarios(
  childSupport: RuleOutcome<ChildSupportResult>,
  alimony: RuleOutcome<AlimonyResult>,
): PackageScenario[] {
  const scenarios: PackageScenario[] = [];

  if (childSupport.kind === "calculated") {
    const result = childSupport.result;
    const obligorLabel = result.obligorParentId === "parent1" ? "You (parent 1)" : "Your spouse (parent 2)";
    scenarios.push({
      scenarioId: "child-support-primary",
      topic: "child-support",
      title: result.substantialTimeSharingApplied
        ? "Child support — substantial time-sharing model"
        : "Child support — standard model",
      description:
        `${obligorLabel} would pay approximately ${formatCents(result.monthlyTransferAmountCents)} per month ` +
        `toward the children's total minimum need of ${formatCents(result.totalMinimumChildSupportNeedCents)}, ` +
        "before any court-ordered deviation.",
      figures: {
        monthlyTransferAmount: formatCents(result.monthlyTransferAmountCents),
        totalMinimumChildSupportNeed: formatCents(result.totalMinimumChildSupportNeedCents),
        obligorParentId: result.obligorParentId ?? "unknown",
      },
    });
  }

  if (alimony.kind === "calculated") {
    const result = alimony.result;
    for (const form of result.formAvailability) {
      if (!form.available) continue;
      scenarios.push({
        scenarioId: `alimony-${form.form}`,
        topic: "alimony",
        title: `Alimony — ${form.form} scenario`,
        description: form.reason,
        figures: {
          maxDurationMonths: form.maxDurationMonths !== null ? String(form.maxDurationMonths) : "No statutory ceiling computed",
          illustrativeAmountCeiling: formatCents(result.amountCeiling.rangeCeilingCents),
        },
      });
    }
  }

  return scenarios;
}
