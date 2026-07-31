import { formatCentsAsDollars } from "@/domain/package";
import type { ChildSupportResult, RuleOutcome } from "@/domain/rules";

import { FormulaTraceTable } from "./FormulaTraceTable";
import { RuleOutcomeStatus } from "./RuleOutcomeStatus";

interface ChildSupportOutcomeCardProps {
  outcome: RuleOutcome<ChildSupportResult>;
}

/** Renders the Florida §61.30 child support outcome, including a full formula trace when calculated. */
export function ChildSupportOutcomeCard({ outcome }: ChildSupportOutcomeCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-semibold text-slate-950">Child support (estimate)</h2>

      {outcome.kind !== "calculated" ? (
        <RuleOutcomeStatus outcome={outcome} />
      ) : (
        <>
          <div className="rounded-md border-2 border-blue-800 bg-blue-50 p-4">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-900">
              Estimated monthly transfer amount
            </p>
            <p className="text-3xl font-bold text-blue-950">
              {formatCentsAsDollars(outcome.result.monthlyTransferAmountCents)}
            </p>
            <p className="text-sm text-blue-900">
              {outcome.result.obligorParentId
                ? `Paid by ${outcome.result.obligorParentId === "parent1" ? "Parent 1" : "Parent 2"} to the other parent, each month. This is an estimate, not a court order.`
                : "No transfer is indicated based on the facts entered. This is an estimate, not a court order."}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Combined net monthly income
              </dt>
              <dd className="text-slate-950">{formatCentsAsDollars(outcome.result.combinedNetMonthlyIncomeCents)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Total minimum child support need
              </dt>
              <dd className="text-slate-950">
                {formatCentsAsDollars(outcome.result.totalMinimumChildSupportNeedCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Substantial time-sharing adjustment applied
              </dt>
              <dd className="text-slate-950">{outcome.result.substantialTimeSharingApplied ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Above the published schedule
              </dt>
              <dd className="text-slate-950">{outcome.result.wasAboveSchedule ? "Yes" : "No"}</dd>
            </div>
          </dl>

          {outcome.warnings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {outcome.warnings.map((warning) => (
                <li
                  key={warning.flagId}
                  className="rounded-md border border-amber-700 bg-amber-50 p-3 text-sm text-amber-950"
                >
                  {warning.description}
                </li>
              ))}
            </ul>
          )}

          <details className="rounded-md border border-slate-300 p-3">
            <summary className="cursor-pointer font-semibold text-slate-950">
              Show full formula trace ({outcome.formulaTrace.length} steps)
            </summary>
            <div className="mt-3">
              <FormulaTraceTable steps={outcome.formulaTrace} />
            </div>
          </details>
        </>
      )}
    </section>
  );
}
