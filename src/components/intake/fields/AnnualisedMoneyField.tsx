"use client";

import { useId, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui";

import { FieldWrapper } from "./FieldWrapper";
import { textInputClasses } from "./inputStyles";

interface AnnualisedMoneyFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  registration: UseFormRegisterReturn;
  /** Applies the converted monthly figure to the underlying form field. */
  onApplyMonthly: (monthly: number) => void;
}

/**
 * A monthly dollar input with an optional "I only know the yearly amount"
 * helper that divides by 12.
 *
 * Bonuses, commissions, and vesting equity arrive in lumps — quarterly,
 * annually, or on a vest date — so asking only for a monthly figure invites
 * either a guess or a blank. The stored value stays monthly because
 * Fla. Stat. §61.30(2) requires income to be determined on a monthly basis.
 *
 * The division is arithmetic, not a legal rule, and is labelled that way:
 * §61.30 prescribes no method for averaging fluctuating pay, so how a court
 * annualises a variable bonus is a matter for argument. Presenting ÷12 as
 * *the* answer would be inventing a rule the statute does not contain.
 */
export function AnnualisedMoneyField({
  id,
  label,
  hint,
  error,
  registration,
  onApplyMonthly,
}: AnnualisedMoneyFieldProps) {
  const [showHelper, setShowHelper] = useState(false);
  const [annual, setAnnual] = useState("");
  const helperId = useId();

  const parsedAnnual = Number(annual);
  const monthly = annual.trim() !== "" && Number.isFinite(parsedAnnual) && parsedAnnual >= 0
    ? Math.round((parsedAnnual / 12) * 100) / 100
    : null;

  return (
    <div className="flex flex-col gap-1">
      <FieldWrapper id={id} label={`${label} (per month)`} hint={hint} error={error}>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
          >
            $
          </span>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0"
            className={`${textInputClasses} pl-7 tabular-nums`}
            aria-invalid={Boolean(error)}
            {...registration}
          />
        </div>
      </FieldWrapper>

      <button
        type="button"
        onClick={() => setShowHelper((open) => !open)}
        aria-expanded={showHelper}
        aria-controls={helperId}
        className="self-start text-sm font-medium text-ink-muted underline underline-offset-2 hover:no-underline"
      >
        {showHelper ? "Hide the yearly-amount helper" : "I only know the yearly amount"}
      </button>

      {showHelper && (
        <div id={helperId} className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-surface-hover p-3">
          <label htmlFor={`${id}-annual`} className="text-sm font-medium text-ink">
            Amount received over a full year
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
            >
              $
            </span>
            <input
              id={`${id}-annual`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0"
              value={annual}
              onChange={(event) => setAnnual(event.target.value)}
              className={`${textInputClasses} pl-7 tabular-nums`}
            />
          </div>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {monthly === null
              ? "Enter the yearly total and we'll divide it by 12."
              : `That's $${monthly.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month.`}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={monthly === null}
            onClick={() => {
              if (monthly !== null) onApplyMonthly(monthly);
            }}
          >
            Use this monthly amount
          </Button>
          <p className="text-xs text-ink-muted">
            Dividing by 12 is just arithmetic, not a legal rule. Florida law requires income to be figured
            monthly (§61.30(2)) but does not say how to average pay that changes from year to year, so a court
            may look at a different period — often a multi-year average. If your variable pay swings a lot, that
            choice can move the number and is worth raising with an attorney.
          </p>
        </div>
      )}
    </div>
  );
}
