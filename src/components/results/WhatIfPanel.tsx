"use client";

import { useCallback, useId, useState, type FormEvent } from "react";

import type { ReviewedIntakeDraft } from "@/domain/intake";
import { formatCentsAsDollars } from "@/domain/package";
import type { AppliedOverride, ScenarioResult } from "@/domain/scenario";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/**
 * "What would this be if I earned nine thousand instead?"
 *
 * The question people actually want answered, and the one the assistant is
 * structurally unable to answer: it never sees your case, and every dollar
 * figure is stripped from its output before you see it. So the app answers it
 * instead — same deterministic Florida calculators as the real estimate, run
 * server-side on your confirmed answers with one number swapped.
 *
 * Three things this panel is careful about:
 *
 * - **You type the number, not the model.** A figure parsed out of a sentence
 *   is a figure that can be misread, and the misreading would be invisible
 *   inside a currency-formatted answer.
 * - **Nothing is saved.** A what-if is not part of your case, does not touch
 *   your answers, and cannot appear in any document. Said plainly on screen,
 *   because "did that just change my case?" is the first thing anyone wonders.
 * - **The change is echoed back.** Every result restates what it changed and
 *   what it changed from, so a wrong entry is visible next to its own answer.
 */

interface WhatIfPanelProps {
  reviewed: ReviewedIntakeDraft;
  /** True when answers changed after the estimate; a what-if off stale figures would mislead. */
  disabled?: boolean;
}

type PanelState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ready"; scenario: ScenarioResult }
  | { status: "error"; message: string };

/** Dollars in the box, cents on the wire. Empty means "leave this one alone". */
function toCents(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed.replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

function toNights(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) return undefined;
  return parsed;
}

function describeOverride(override: AppliedOverride): string {
  if (override.toCents !== undefined) {
    const from = override.fromCents !== undefined ? formatCentsAsDollars(override.fromCents) : "your saved answer";
    return `${override.label}: ${from} → ${formatCentsAsDollars(override.toCents)}`;
  }
  const from = override.from !== undefined ? String(override.from) : "your saved answer";
  return `${override.label}: ${from} → ${override.to}`;
}

export function WhatIfPanel({ reviewed, disabled = false }: WhatIfPanelProps) {
  const selfIncomeId = useId();
  const spouseIncomeId = useId();
  const overnightsId = useId();

  const [selfIncome, setSelfIncome] = useState("");
  const [spouseIncome, setSpouseIncome] = useState("");
  const [overnights, setOvernights] = useState("");
  const [state, setState] = useState<PanelState>({ status: "idle" });

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (disabled) return;

      const overrides = {
        selfMonthlyGrossIncomeCents: toCents(selfIncome),
        spouseMonthlyGrossIncomeCents: toCents(spouseIncome),
        selfAnnualOvernights: toNights(overnights),
      };
      const supplied = Object.fromEntries(
        Object.entries(overrides).filter(([, value]) => value !== undefined),
      );

      if (Object.keys(supplied).length === 0) {
        setState({
          status: "error",
          message: "Enter at least one number to try. Leave the others blank to keep your saved answers.",
        });
        return;
      }

      setState({ status: "running" });
      try {
        const response = await fetch("/api/scenario", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewedDraft: reviewed, overrides: supplied }),
        });
        if (!response.ok) {
          const message = (await response.json().catch(() => null))?.error ?? null;
          throw new Error(message ?? `Server responded with ${response.status}`);
        }
        const body = await response.json();
        setState({ status: "ready", scenario: body.scenario as ScenarioResult });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "The what-if could not be calculated.",
        });
      }
    },
    [disabled, overnights, reviewed, selfIncome, spouseIncome],
  );

  const scenario = state.status === "ready" ? state.scenario : null;
  const childSupport = scenario?.childSupport;
  const alimony = scenario?.alimony;

  return (
    <section className="flex flex-col gap-4" data-testid="what-if-panel">
      <p className="text-sm text-ink-muted">
        Try a different number without changing your answers. This uses the same Florida calculations as the
        estimate above — it is not a prediction, and <strong>nothing here is saved to your case</strong> or
        included in any document you download.
      </p>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={selfIncomeId} className="text-sm font-medium text-ink">
              Your monthly gross income
            </label>
            <input
              id={selfIncomeId}
              name="selfMonthlyGrossIncome"
              inputMode="decimal"
              placeholder="Leave blank to keep"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
              value={selfIncome}
              onChange={(event) => setSelfIncome(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={spouseIncomeId} className="text-sm font-medium text-ink">
              Your spouse&rsquo;s monthly gross income
            </label>
            <input
              id={spouseIncomeId}
              name="spouseMonthlyGrossIncome"
              inputMode="decimal"
              placeholder="Leave blank to keep"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
              value={spouseIncome}
              onChange={(event) => setSpouseIncome(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={overnightsId} className="text-sm font-medium text-ink">
              Your overnights per year
            </label>
            <input
              id={overnightsId}
              name="selfAnnualOvernights"
              inputMode="numeric"
              placeholder="0–365"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
              value={overnights}
              onChange={(event) => setOvernights(event.target.value)}
            />
            <p className="text-xs text-ink-subtle">
              Your spouse gets the rest of the year, since the nights have to add up.
            </p>
          </div>
        </div>

        <div>
          <Button type="submit" disabled={disabled || state.status === "running"}>
            {state.status === "running" ? "Calculating…" : "Try this what-if"}
          </Button>
        </div>
      </form>

      {disabled && (
        <Alert variant="warning" role="status" title="Recalculate first.">
          <p className="text-sm">
            Your answers changed after this estimate, so a what-if would be measured against out-of-date
            figures.
          </p>
        </Alert>
      )}

      {state.status === "error" && (
        <Alert variant="warning" role="alert" title="That what-if could not be calculated.">
          <p className="text-sm">{state.message}</p>
        </Alert>
      )}

      {scenario && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4" data-testid="what-if-result">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Hypothetical — not saved
          </p>

          <div>
            <p className="text-sm font-medium text-ink">What was changed</p>
            <ul className="mt-1 flex flex-col gap-1">
              {scenario.appliedOverrides.map((override) => (
                <li key={override.field} className="text-sm tabular-nums text-ink-muted">
                  {describeOverride(override)}
                </li>
              ))}
            </ul>
          </div>

          <dl className="flex flex-col gap-1">
            {childSupport?.kind === "calculated" && (
              <div className="flex justify-between gap-2 text-sm">
                <dt className="text-ink-muted">Monthly child support transfer</dt>
                <dd className="font-medium tabular-nums text-ink" data-testid="what-if-child-support">
                  {formatCentsAsDollars(childSupport.result.monthlyTransferAmountCents)}
                </dd>
              </div>
            )}
            {alimony?.kind === "calculated" && (
              <div className="flex justify-between gap-2 text-sm">
                <dt className="text-ink-muted">Monthly alimony range</dt>
                <dd className="font-medium tabular-nums text-ink" data-testid="what-if-alimony">
                  {formatCentsAsDollars(0)} –{" "}
                  {formatCentsAsDollars(alimony.result.amountCeiling.rangeCeilingCents)}
                </dd>
              </div>
            )}
          </dl>

          {scenario.notes.length > 0 && (
            <ul className="flex flex-col gap-1">
              {scenario.notes.map((note) => (
                <li key={note} className="text-sm text-ink-muted">
                  {note}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-ink-subtle">
            An estimate under the same Florida rules as your saved results, not a prediction of what a judge
            would order. Your saved answers and your downloadable package are unchanged.
          </p>
        </div>
      )}
    </section>
  );
}
