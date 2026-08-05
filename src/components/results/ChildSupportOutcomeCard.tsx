import { formatCentsAsDollars } from "@/domain/package";
import type { ChildSupportResult, RuleOutcome } from "@/domain/rules";

import { Alert, Card } from "@/components/ui";
import { FormulaTraceTable } from "./FormulaTraceTable";
import { RuleOutcomeStatus } from "./RuleOutcomeStatus";

interface ChildSupportOutcomeCardProps {
  outcome: RuleOutcome<ChildSupportResult>;
}

/** Renders the Florida §61.30 child support outcome, including a full formula trace when calculated. */
export function ChildSupportOutcomeCard({ outcome }: ChildSupportOutcomeCardProps) {
  return (
    <Card as="section" className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-ink">Child support (estimate)</h2>

      {outcome.kind !== "calculated" ? (
        <RuleOutcomeStatus outcome={outcome} />
      ) : (
        <>
          <div className="rounded-xl border border-primary-border bg-primary-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-info-solid">
              Estimated monthly transfer amount
            </p>
            <p
              className="mt-1 text-4xl font-bold tabular-nums text-info-text sm:text-5xl"
              data-testid="child-support-transfer-amount"
            >
              {formatCentsAsDollars(outcome.result.monthlyTransferAmountCents)}
            </p>
            <p className="mt-2 text-sm text-info-text">
              {outcome.result.obligorParentId
                ? `Paid by ${outcome.result.obligorParentId === "parent1" ? "Parent 1" : "Parent 2"} to the other parent, each month. This is an estimate, not a court order.`
                : "No transfer is indicated based on the facts entered. This is an estimate, not a court order."}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetricItem
              label="Combined net monthly income"
              value={formatCentsAsDollars(outcome.result.combinedNetMonthlyIncomeCents)}
            />
            <MetricItem
              label="Total minimum child support need"
              value={formatCentsAsDollars(outcome.result.totalMinimumChildSupportNeedCents)}
            />
            <MetricItem
              label="Substantial time-sharing adjustment applied"
              value={outcome.result.substantialTimeSharingApplied ? "Yes" : "No"}
            />
            <MetricItem
              label="Above the published schedule"
              value={outcome.result.wasAboveSchedule ? "Yes" : "No"}
            />
          </dl>

          {outcome.warnings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {outcome.warnings.map((warning) => (
                <li key={warning.flagId}>
                  <Alert variant="warning" className="text-sm">
                    {warning.description}
                  </Alert>
                </li>
              ))}
            </ul>
          )}

          <details className="group rounded-xl border border-border bg-surface-2 p-4">
            <summary className="cursor-pointer font-semibold text-ink marker:text-ink-subtle">
              Show full formula trace ({outcome.formulaTrace.length} steps)
            </summary>
            <div className="mt-3">
              <FormulaTraceTable steps={outcome.formulaTrace} />
            </div>
          </details>
        </>
      )}
    </Card>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface-2 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="text-base font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
