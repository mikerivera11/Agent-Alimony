import { formatCentsAsDollars } from "@/domain/package";
import { ALIMONY_FORM_LABELS } from "@/domain/rules";
import type { AlimonyResult, RuleOutcome } from "@/domain/rules";

import { Alert, Card } from "@/components/ui";
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
    <Card as="section" className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-ink">Alimony (estimate)</h2>

      {outcome.kind !== "calculated" ? (
        <RuleOutcomeStatus outcome={outcome} />
      ) : (
        <>
          <div className="rounded-xl border border-primary-border bg-primary-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-info-solid">Estimated monthly amount range</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-info-text sm:text-5xl">
              {formatCentsAsDollars(0)} – {formatCentsAsDollars(outcome.result.amountCeiling.rangeCeilingCents)}
            </p>
            <p className="mt-2 text-sm text-info-text">
              A court has broad discretion within this range. This is an estimate, not a court order.
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface-2 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Marriage duration</dt>
              <dd className="text-base font-medium text-ink">
                {outcome.result.marriageDurationCategory} ({outcome.result.marriageDurationMonths} months)
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface-2 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Ceiling limiting factor</dt>
              <dd className="text-base font-medium text-ink">
                {outcome.result.amountCeiling.limitingFactor === "reasonableNeed"
                  ? "Confirmed reasonable need"
                  : "35% of net income difference"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-ink">Form availability</h3>
            <ul className="flex flex-col gap-2">
              {outcome.result.formAvailability.map((form) => (
                <li key={form.form} className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink">
                  <span className="font-semibold">{ALIMONY_FORM_LABELS[form.form]}:</span> {form.available ? "Available" : "Not available"}{" "}
                  — {form.reason}
                  {form.maxDurationMonths !== null && ` (max ${form.maxDurationMonths} months)`}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-ink">§61.08(3) factor analysis</h3>
            <ul className="flex flex-col gap-2">
              {outcome.result.subsectionThreeFactors.map((factor) => (
                <li key={factor.factorId} className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink">
                  <span className="font-semibold">{factor.citation}:</span> {factor.description}
                </li>
              ))}
            </ul>
          </div>

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
        </>
      )}
    </Card>
  );
}
