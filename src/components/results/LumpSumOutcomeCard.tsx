"use client";

import { useMemo, useState } from "react";

import {
  MAX_DISCOUNT_RATE_BPS,
  MIN_DISCOUNT_RATE_BPS,
  combineSettlementComponents,
  modelLumpSum,
  LumpSumInputError,
  type LumpSumModel,
} from "@/domain/finance";
import { formatCentsAsDollars } from "@/domain/package";
import type { PackageLumpSum } from "@/domain/package";
import { cents } from "@/domain/rules";

import { Alert, Card } from "@/components/ui";
import { textInputClasses } from "@/components/intake/fields/inputStyles";

interface LumpSumOutcomeCardProps {
  lumpSum: PackageLumpSum;
}

function spouseName(lumpSum: PackageLumpSum, spouse: "a" | "b" | null): string {
  if (spouse === "a") return lumpSum.partyALabel;
  if (spouse === "b") return lumpSum.partyBLabel;
  return "—";
}

/** Basis points → a human percentage string, e.g. 525 → "5.25". */
function bpsToPercentString(bps: number): string {
  return (bps / 100).toString();
}

/** A user-entered percentage → basis points, clamped to the model's supported band. */
function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function LumpSumOutcomeCard({ lumpSum }: LumpSumOutcomeCardProps) {
  const [ratePercent, setRatePercent] = useState<string>(() => bpsToPercentString(lumpSum.illustrativeRateBps));

  const parsedPercent = Number.parseFloat(ratePercent);
  const rateBps = Number.isFinite(parsedPercent) ? percentToBps(parsedPercent) : Number.NaN;
  const rateOutOfRange =
    Number.isFinite(rateBps) && (rateBps < MIN_DISCOUNT_RATE_BPS || rateBps > MAX_DISCOUNT_RATE_BPS);

  const model: LumpSumModel | null = useMemo(() => {
    if (!lumpSum.available || !Number.isFinite(rateBps) || rateOutOfRange) return null;
    try {
      return modelLumpSum({
        monthlyAmountCents: cents(lumpSum.monthlyAmountCents),
        numberOfMonths: lumpSum.numberOfMonths,
        annualDiscountRateBps: rateBps,
      });
    } catch (error) {
      if (error instanceof LumpSumInputError) return null;
      throw error;
    }
  }, [lumpSum, rateBps, rateOutOfRange]);

  if (!lumpSum.available) {
    return (
      <Card as="section" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-ink">Lump-sum settlement (optional)</h2>
        <Alert variant="info" role="note">
          {lumpSum.reason ?? "A lump-sum illustration isn't available for this case."}
        </Alert>
      </Card>
    );
  }

  const combined =
    model !== null
      ? combineSettlementComponents({
          alimonyLumpSumCents: model.selected.presentValueCents,
          equalizingPaymentCents: cents(lumpSum.equalizingPaymentCents),
          // Same direction only when the same spouse owes BOTH components.
          sameDirection:
            lumpSum.alimonyPayorSpouse !== null &&
            lumpSum.equalizingFromSpouse !== null &&
            lumpSum.alimonyPayorSpouse === lumpSum.equalizingFromSpouse,
        })
      : null;

  // Which spouse ends up making the single net transfer, for plain-language display.
  const netPayor = (() => {
    if (model === null) return null;
    const alimonyCents = model.selected.presentValueCents;
    const equalizingCents = lumpSum.equalizingPaymentCents;
    if (
      lumpSum.alimonyPayorSpouse !== null &&
      lumpSum.equalizingFromSpouse !== null &&
      lumpSum.alimonyPayorSpouse === lumpSum.equalizingFromSpouse
    ) {
      return lumpSum.alimonyPayorSpouse;
    }
    return alimonyCents >= equalizingCents ? lumpSum.alimonyPayorSpouse : lumpSum.equalizingFromSpouse;
  })();

  return (
    <Card as="section" className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-ink">Lump-sum settlement (optional)</h2>

      <Alert variant="warning" role="note" title="This is your assumption, not the law">
        No Florida statute sets a discount rate or a present-value formula. The figures below depend entirely on the
        rate you choose, so they are shown as a <strong>range</strong>, never a single &ldquo;correct&rdquo; number.
      </Alert>

      <div className="flex flex-col gap-2">
        <label htmlFor="lump-sum-rate" className="block text-base font-semibold text-ink">
          Your assumed annual discount rate
        </label>
        <p className="text-sm text-ink-muted">
          The rate reflects the time value of money — how much a dollar today is worth compared with a dollar paid over
          the coming months. Try a few values to see the effect.
        </p>
        <div className="flex items-center gap-2">
          <input
            id="lump-sum-rate"
            type="number"
            inputMode="decimal"
            min={MIN_DISCOUNT_RATE_BPS / 100}
            max={MAX_DISCOUNT_RATE_BPS / 100}
            step="0.25"
            value={ratePercent}
            onChange={(event) => setRatePercent(event.target.value)}
            className={`${textInputClasses} max-w-32`}
            aria-describedby={rateOutOfRange ? "lump-sum-rate-error" : undefined}
            aria-invalid={rateOutOfRange}
          />
          <span className="text-base text-ink">% per year</span>
        </div>
        {rateOutOfRange && (
          <p id="lump-sum-rate-error" role="alert" className="text-sm font-semibold text-danger-solid">
            Enter a rate between {MIN_DISCOUNT_RATE_BPS / 100}% and {MAX_DISCOUNT_RATE_BPS / 100}%.
          </p>
        )}
      </div>

      {model === null ? (
        <Alert variant="info" role="status">
          Enter a valid discount rate to see the present value.
        </Alert>
      ) : (
        <>
          <div className="rounded-xl border border-primary-border bg-primary-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-info-solid">
              Present value at {bpsToPercentString(model.selected.annualDiscountRateBps)}%
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-info-text sm:text-5xl">
              {formatCentsAsDollars(model.selected.presentValueCents)}
            </p>
            <p className="mt-2 text-sm text-info-text">
              Converts {formatCentsAsDollars(lumpSum.monthlyAmountCents)}/month for {lumpSum.numberOfMonths} months
              (undiscounted total {formatCentsAsDollars(model.selected.undiscountedTotalCents)}; discount{" "}
              {formatCentsAsDollars(model.selected.discountAmountCents)}).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-ink">Sensitivity band</h3>
            <p className="text-sm text-ink-muted">
              How the present value moves as the assumed rate changes. There is no single right rate.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Present value by discount rate</caption>
                <thead>
                  <tr className="border-b-2 border-border-strong text-xs uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="py-1.5 pr-3">
                      Discount rate
                    </th>
                    <th scope="col" className="py-1.5 pr-3">
                      Present value
                    </th>
                    <th scope="col" className="py-1.5">
                      Discount vs. undiscounted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.range.map((scenario) => {
                    const isSelected = scenario.annualDiscountRateBps === model.selected.annualDiscountRateBps;
                    return (
                      <tr
                        key={scenario.annualDiscountRateBps}
                        className={`border-b border-border align-top ${isSelected ? "bg-primary-surface font-semibold" : ""}`}
                      >
                        <td className="py-2 pr-3 tabular-nums text-ink">
                          {bpsToPercentString(scenario.annualDiscountRateBps)}%{isSelected ? " (yours)" : ""}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-ink">
                          {formatCentsAsDollars(scenario.presentValueCents)}
                        </td>
                        <td className="py-2 tabular-nums text-ink-muted">
                          {formatCentsAsDollars(scenario.discountAmountCents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {combined !== null && (
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <h3 className="text-lg font-semibold text-ink">Combined with the property equalizing payment</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Alimony lump sum {formatCentsAsDollars(model.selected.presentValueCents)} +{" "}
                property equalizing payment {formatCentsAsDollars(lumpSum.equalizingPaymentCents)}
                {combined.componentsOffset ? ", which point in opposite directions and partly cancel out." : "."}
              </p>
              <p className="mt-2 text-base font-medium text-ink">
                Single net transfer:{" "}
                <span className="tabular-nums font-semibold">{formatCentsAsDollars(combined.totalTransferCents)}</span>
                {combined.totalTransferCents > 0 && netPayor ? (
                  <> — paid by {spouseName(lumpSum, netPayor)}.</>
                ) : (
                  <> — the two components fully offset.</>
                )}
              </p>
            </div>
          )}

          {model.assumptions.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-ink">Assumptions behind this figure</h3>
              <ul className="flex flex-col gap-2">
                {model.assumptions.map((assumption, index) => (
                  <li key={index}>
                    <Alert variant="info" className="text-sm">
                      {assumption}
                    </Alert>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {model.warnings.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-ink">Important warnings</h3>
              <ul className="flex flex-col gap-2">
                {model.warnings.map((warning, index) => (
                  <li key={index}>
                    <Alert variant="warning" role="note" className="text-sm">
                      {warning}
                    </Alert>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
