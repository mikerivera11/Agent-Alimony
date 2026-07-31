import { formatCentsAsDollars } from "@/domain/package";
import type { AlimonyResult, RuleOutcome } from "@/domain/rules";

import { RuleOutcomeStatus } from "./RuleOutcomeStatus";

interface AlimonyOutcomeCardProps {
  outcome: RuleOutcome<AlimonyResult>;
}

/**
 * Renders the Florida §61.08 alimony outcome or a transparent missing-input
 * state when the user has not confirmed a planning recipient.
 */
export function AlimonyOutcomeCard({ outcome }: AlimonyOutcomeCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-semibold text-slate-950">Alimony (estimate)</h2>

      {outcome.kind !== "calculated" ? (
        <RuleOutcomeStatus outcome={outcome} />
      ) : (
        <>
          <div className="rounded-md border-2 border-blue-800 bg-blue-50 p-4">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-900">Estimated monthly amount range</p>
            <p className="text-3xl font-bold text-blue-950">
              {formatCentsAsDollars(0)} – {formatCentsAsDollars(outcome.result.amountCeiling.rangeCeilingCents)}
            </p>
            <p className="text-sm text-blue-900">
              A court has broad discretion within this range. This is an estimate, not a court order.
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Marriage duration</dt>
              <dd className="text-slate-950">
                {outcome.result.marriageDurationCategory} ({outcome.result.marriageDurationMonths} months)
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Ceiling limiting factor</dt>
              <dd className="text-slate-950">
                {outcome.result.amountCeiling.limitingFactor === "reasonableNeed"
                  ? "Confirmed reasonable need"
                  : "35% of net income difference"}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="text-lg font-semibold text-slate-950">Form availability</h3>
            <ul className="flex flex-col gap-2">
              {outcome.result.formAvailability.map((form) => (
                <li key={form.form} className="rounded-md border border-slate-300 p-3 text-sm text-slate-900">
                  <span className="font-semibold">{form.form}:</span> {form.available ? "Available" : "Not available"}{" "}
                  — {form.reason}
                  {form.maxDurationMonths !== null && ` (max ${form.maxDurationMonths} months)`}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-950">§61.08(3) factor analysis</h3>
            <ul className="flex flex-col gap-2">
              {outcome.result.subsectionThreeFactors.map((factor) => (
                <li key={factor.factorId} className="rounded-md border border-slate-300 p-3 text-sm text-slate-900">
                  <span className="font-semibold">{factor.citation}:</span> {factor.description}
                </li>
              ))}
            </ul>
          </div>

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
        </>
      )}
    </section>
  );
}
