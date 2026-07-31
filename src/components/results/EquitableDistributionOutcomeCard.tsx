import { formatCentsAsDollars } from "@/domain/package";
import type {
  DistributionScenario,
  EdSpouse,
  EquitableDistributionResult,
  RuleOutcome,
} from "@/domain/rules";

import { Alert, Badge, Card } from "@/components/ui";
import { FormulaTraceTable } from "./FormulaTraceTable";
import { RuleOutcomeStatus } from "./RuleOutcomeStatus";

interface EquitableDistributionOutcomeCardProps {
  outcome: RuleOutcome<EquitableDistributionResult>;
}

function spouseLabel(result: EquitableDistributionResult, spouse: EdSpouse | null): string {
  if (spouse === "a") return result.partyALabel;
  if (spouse === "b") return result.partyBLabel;
  return "—";
}

function EqualizingPaymentLine({
  result,
  scenario,
}: {
  result: EquitableDistributionResult;
  scenario: DistributionScenario;
}) {
  const { equalizingPayment } = scenario;
  if (equalizingPayment.fromSpouse === null || equalizingPayment.amountCents === 0) {
    return <p className="text-base font-medium text-ink">No equalizing payment needed — holdings already balance.</p>;
  }
  return (
    <p className="text-base font-medium text-ink">
      <span className="font-semibold">{spouseLabel(result, equalizingPayment.fromSpouse)}</span> pays{" "}
      <span className="font-semibold">{spouseLabel(result, equalizingPayment.toSpouse)}</span>{" "}
      <span className="tabular-nums">{formatCentsAsDollars(equalizingPayment.amountCents)}</span> to reach an equal split.
    </p>
  );
}

function ScenarioColumn({
  title,
  subtitle,
  result,
  scenario,
}: {
  title: string;
  subtitle: string;
  result: EquitableDistributionResult;
  scenario: DistributionScenario;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
      <div>
        <h4 className="text-base font-semibold text-ink">{title}</h4>
        <p className="text-sm text-ink-muted">{subtitle}</p>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Marital assets</dt>
          <dd className="tabular-nums text-ink">{formatCentsAsDollars(scenario.maritalAssetsCents)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Marital debts</dt>
          <dd className="tabular-nums text-ink">{formatCentsAsDollars(scenario.maritalLiabilitiesCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-semibold">
          <dt className="text-ink">Net marital estate</dt>
          <dd className="tabular-nums text-ink">{formatCentsAsDollars(scenario.netMaritalEstateCents)}</dd>
        </div>
      </dl>
      <EqualizingPaymentLine result={result} scenario={scenario} />
    </div>
  );
}

/**
 * Renders the Fla. Stat. §61.075 equitable-distribution outcome. Shows the
 * nonmarital set-asides, the marital estate, the equalizing payment, and BOTH
 * the with-exclusions and without-exclusions scenarios side by side so the
 * effect of each written-agreement exclusion is visible. The §61.075(1)(a)-(j)
 * factors are shown as display-only data — this tool never scores them.
 */
export function EquitableDistributionOutcomeCard({ outcome }: EquitableDistributionOutcomeCardProps) {
  return (
    <Card as="section" className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-ink">Dividing property &amp; debts (estimate)</h2>

      {outcome.kind !== "calculated" ? (
        <RuleOutcomeStatus outcome={outcome} />
      ) : (
        <EquitableDistributionCalculated outcome={outcome} />
      )}
    </Card>
  );
}

function EquitableDistributionCalculated({
  outcome,
}: {
  outcome: Extract<RuleOutcome<EquitableDistributionResult>, { kind: "calculated" }>;
}) {
  const { result } = outcome;
  const blocking = outcome.warnings.filter((w) => w.severity === "blocking");
  const nonBlocking = outcome.warnings.filter((w) => w.severity !== "blocking");
  const setAside = result.nonmaritalSetAside;

  return (
    <>
      {blocking.length > 0 && (
        <ul className="flex flex-col gap-2">
          {blocking.map((flag) => (
            <li key={flag.flagId}>
              <Alert variant="danger" emphasis role="alert" title="Action needed">
                {flag.description}
                {flag.citation ? <span className="block text-xs text-ink-subtle">{flag.citation}</span> : null}
              </Alert>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-primary-border bg-primary-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-info-solid">Equalizing payment</p>
        <div className="mt-1 text-info-text">
          <EqualizingPaymentLine result={result} scenario={result.distributionWithExclusions} />
        </div>
        <p className="mt-2 text-sm text-info-text">
          Florida law starts from an <strong>equal (50/50) split</strong> of the shared marital estate
          (Fla. Stat. §61.075(1)). This is an estimate, not a court order.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-ink">Separate (nonmarital) property set aside</h3>
        <p className="text-sm text-ink-muted">
          These items are kept by their owner and are not part of the split (Fla. Stat. §61.075(6)(b)).
        </p>
        {setAside.items.length === 0 ? (
          <p className="text-sm text-ink">No items were set aside as separate property.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {setAside.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink"
              >
                <span>
                  <span className="font-semibold">{item.label}</span>{" "}
                  <span className="text-ink-muted">
                    — kept by {item.owner === "joint" ? "both spouses" : spouseLabel(result, item.owner)}
                  </span>
                  <span className="block text-xs text-ink-subtle">{item.basisCitation}</span>
                </span>
                <span className="tabular-nums font-medium">{formatCentsAsDollars(item.valueCents)}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <dt className="text-ink-muted">{result.partyALabel} keeps (net)</dt>
            <dd className="tabular-nums font-medium text-ink">{formatCentsAsDollars(setAside.aNetCents)}</dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <dt className="text-ink-muted">{result.partyBLabel} keeps (net)</dt>
            <dd className="tabular-nums font-medium text-ink">{formatCentsAsDollars(setAside.bNetCents)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-ink">Effect of the written-agreement exclusions</h3>
        <p className="text-sm text-ink-muted">
          The two columns show the split with and without the items you asked to leave out of the estate, so the effect
          of each exclusion is visible.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ScenarioColumn
            title="With exclusions applied"
            subtitle="Items excluded by written agreement removed"
            result={result}
            scenario={result.distributionWithExclusions}
          />
          <ScenarioColumn
            title="Without any exclusions"
            subtitle="Every marital item kept in the estate"
            result={result}
            scenario={result.baselineWithoutExclusions}
          />
        </div>
      </div>

      {result.exclusions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-ink">Items you asked to exclude</h3>
          <ul className="flex flex-col gap-2">
            {result.exclusions.map((exclusion) => (
              <li
                key={exclusion.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{exclusion.label}</span>
                  <Badge tone={exclusion.honored ? "success" : "warning"}>
                    {exclusion.honored ? "Excluded" : "Kept in estate"}
                  </Badge>
                </div>
                <span className="text-ink-muted">{exclusion.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nonBlocking.length > 0 && (
        <ul className="flex flex-col gap-2">
          {nonBlocking.map((flag) => (
            <li key={flag.flagId}>
              <Alert variant={flag.severity === "warning" ? "warning" : "info"} className="text-sm">
                {flag.description}
                {flag.citation ? <span className="block text-xs text-ink-subtle">{flag.citation}</span> : null}
              </Alert>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-ink">§61.075(1)(a)-(j) factors</h3>
        <p className="text-sm text-ink-muted">
          A judge weighs these factors when deciding whether an unequal split is justified. This tool shows them for
          reference only — it never scores or weights them.
        </p>
        <ul className="flex flex-col gap-2">
          {result.unequalDistributionFactors.map((factor) => (
            <li key={factor.factorId} className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink">
              <span className="font-semibold">{factor.citation}:</span> {factor.description}
            </li>
          ))}
        </ul>
      </div>

      {outcome.formulaTrace.length > 0 && (
        <details className="rounded-xl border border-border bg-surface-2 p-4">
          <summary className="cursor-pointer text-base font-semibold text-ink">
            Show the full calculation trace
          </summary>
          <div className="mt-3 overflow-x-auto">
            <FormulaTraceTable steps={outcome.formulaTrace} />
          </div>
        </details>
      )}
    </>
  );
}
