import type {
  AlimonyResult,
  ChildSupportResult,
  EquitableDistributionResult,
  RuleOutcome,
} from "@/domain/rules";

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
  equitableDistribution: RuleOutcome<EquitableDistributionResult>,
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

  if (equitableDistribution.kind === "calculated") {
    const result = equitableDistribution.result;
    const scenario = result.distributionWithExclusions;
    const payment = scenario.equalizingPayment;
    const fromLabel =
      payment.fromSpouse === "a"
        ? result.partyALabel
        : payment.fromSpouse === "b"
          ? result.partyBLabel
          : null;
    const toLabel = payment.toSpouse === "a" ? result.partyALabel : payment.toSpouse === "b" ? result.partyBLabel : null;
    scenarios.push({
      scenarioId: "equitable-distribution-primary",
      topic: "equitable-distribution",
      title: "Equitable distribution — equal (50/50) premise",
      description:
        fromLabel && toLabel
          ? `Starting from Florida's equal-distribution premise, ${fromLabel} would make an equalizing payment of ` +
            `${formatCents(payment.amountCents)} to ${toLabel} so each keeps an equal share of the net marital estate.`
          : "The net marital estate is already split equally by current holdings, so no equalizing payment is indicated.",
      figures: {
        netMaritalEstate: formatCents(scenario.netMaritalEstateCents),
        equalizingPayment: formatCents(payment.amountCents),
        withoutExclusionsEqualizingPayment: formatCents(
          result.baselineWithoutExclusions.equalizingPayment.amountCents,
        ),
      },
    });
  }

  return scenarios;
}
