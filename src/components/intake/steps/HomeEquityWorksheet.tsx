"use client";

import { useMemo } from "react";
import { useWatch, type Control } from "react-hook-form";

import { Alert } from "@/components/ui";
import type { AssetsDebts } from "@/domain/intake";
import { HomeEquityInputError, calculateHomeEquity, type HomeEquityResult } from "@/domain/finance";
import { cents } from "@/domain/rules/money";

import { CheckboxField, CountField, MoneyField, PercentField, SelectField } from "../fields";
import type { StepFieldsProps } from "./StepFieldsProps";

const GROWTH_BASIS_OPTIONS = [
  { value: "propertyValue", label: "The home's value grows (usual)" },
  { value: "equity", label: "My equity itself grows" },
];

function formatMoney(valueCents: number): string {
  return (valueCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function toCents(dollars: number | undefined): number {
  return Math.round((dollars ?? 0) * 100);
}

/**
 * Optional worksheet for working out home equity, plus a forward projection.
 *
 * The projection is deliberately kept away from the marital estate. Florida
 * classifies and values the estate as of the §61.075(7) cut-off date, so future
 * appreciation is not what a court divides — it is planning information for
 * deciding whether to keep, sell, or buy out the house. The calculation itself
 * runs through the same pure `calculateHomeEquity` function the tests cover;
 * this component only formats it.
 */
export function HomeEquityWorksheet({
  register,
  errors,
  control,
}: Pick<StepFieldsProps<AssetsDebts>, "register" | "errors" | "control">) {
  const worksheet = useWatch({ control, name: "homeEquity" }) as AssetsDebts["homeEquity"] | undefined;
  const enabled = Boolean(worksheet?.enabled);
  const fieldErrors = errors.homeEquity;

  const { result, error } = useMemo((): { result?: HomeEquityResult; error?: string } => {
    if (!enabled || worksheet?.marketValue === undefined || worksheet?.mortgageBalance === undefined) {
      return {};
    }
    const years = Number(worksheet.projectionYears ?? 0);
    const growth = worksheet.annualGrowthPercent;
    if (years > 0 && growth === undefined) {
      return {};
    }
    try {
      return {
        result: calculateHomeEquity({
          marketValueCents: cents(toCents(worksheet.marketValue)),
          mortgageBalanceCents: cents(toCents(worksheet.mortgageBalance)),
          costOfSaleBps: worksheet.costOfSalePercent
            ? Math.round(worksheet.costOfSalePercent * 100)
            : undefined,
          annualPrincipalPaydownCents: worksheet.annualPrincipalPaydown
            ? cents(toCents(worksheet.annualPrincipalPaydown))
            : undefined,
          annualAppreciationBps: Math.round((growth ?? 0) * 100),
          growthBasis: worksheet.growthBasis ?? "propertyValue",
          projectionYears: years,
        }),
      };
    } catch (caught) {
      return { error: caught instanceof HomeEquityInputError ? caught.message : "Check the numbers above." };
    }
  }, [enabled, worksheet]);

  const userScenario = result?.projection.find((scenario) => scenario.isUserSelected);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <CheckboxField
        id="homeEquity.enabled"
        label="Work out the equity in a home"
        hint="Optional. Helps you figure out what to enter as the home's value, and shows how equity could grow."
        registration={register("homeEquity.enabled")}
        error={fieldErrors?.enabled?.message}
      />

      {enabled ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              id="homeEquity.marketValue"
              label="What is the home worth today?"
              hint="Your best estimate of what it would sell for now."
              required
              registration={register("homeEquity.marketValue")}
              error={fieldErrors?.marketValue?.message}
            />
            <MoneyField
              id="homeEquity.mortgageBalance"
              label="Mortgage payoff balance"
              hint="What you still owe. Enter 0 if the home is paid off."
              required
              registration={register("homeEquity.mortgageBalance")}
              error={fieldErrors?.mortgageBalance?.message}
            />
          </div>

          {result ? (
            <div className="rounded-lg border border-border bg-surface-subtle p-4">
              <p className="text-sm text-ink-muted">Equity today</p>
              <p className="text-2xl font-semibold text-ink">{formatMoney(result.current.equityCents)}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {formatMoney(result.current.marketValueCents)} value −{" "}
                {formatMoney(result.current.mortgageBalanceCents)} mortgage
                {worksheet?.costOfSalePercent
                  ? ` · ${formatMoney(result.current.netOfSaleCostsCents)} after selling costs`
                  : ""}
              </p>
              {result.current.isUnderwater ? (
                <Alert variant="warning" role="status" className="mt-3 text-sm">
                  <p>
                    The mortgage is {formatMoney(result.current.negativeEquityCents)} more than the home is
                    worth, so there is no equity to divide right now. That shortfall is a shared debt rather
                    than an asset — add the mortgage as a debt in the list above.
                  </p>
                </Alert>
              ) : null}
            </div>
          ) : null}

          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Project how the equity could grow (optional)
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <PercentField
                  id="homeEquity.annualGrowthPercent"
                  label="Estimated growth per year"
                  hint="Your own estimate — there is no official Florida rate. A negative number models a falling market."
                  min={-20}
                  max={20}
                  registration={register("homeEquity.annualGrowthPercent")}
                  error={fieldErrors?.annualGrowthPercent?.message}
                />
                <CountField
                  id="homeEquity.projectionYears"
                  label="Years to project"
                  hint="Set to 0 for today's equity only."
                  max={30}
                  registration={register("homeEquity.projectionYears")}
                  error={fieldErrors?.projectionYears?.message}
                />
                <SelectField
                  id="homeEquity.growthBasis"
                  label="Apply that growth to…"
                  hint="Growing the home's value is how property actually behaves; because the mortgage is fixed, equity then grows faster than the rate."
                  options={GROWTH_BASIS_OPTIONS}
                  registration={register("homeEquity.growthBasis")}
                  error={fieldErrors?.growthBasis?.message}
                />
                <PercentField
                  id="homeEquity.costOfSalePercent"
                  label="Selling costs (optional)"
                  hint="Commission, title, doc stamps. Often around 6–8%."
                  max={100}
                  registration={register("homeEquity.costOfSalePercent")}
                  error={fieldErrors?.costOfSalePercent?.message}
                />
                <MoneyField
                  id="homeEquity.annualPrincipalPaydown"
                  label="Principal paid off per year (optional)"
                  hint="Leave blank to hold the mortgage flat, which understates future equity."
                  registration={register("homeEquity.annualPrincipalPaydown")}
                  error={fieldErrors?.annualPrincipalPaydown?.message}
                />
              </div>

              {error ? (
                <Alert variant="warning" role="status" className="text-sm">
                  <p>{error}</p>
                </Alert>
              ) : null}

              {result && result.projection.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <Alert variant="info" role="note" className="text-sm">
                    <p>
                      These are <strong>planning figures, not what a court divides.</strong> Florida values the
                      shared estate as of the Fla. Stat. §61.075(7) cut-off date — generally when the petition
                      was filed — so growth after that date isn&apos;t part of the split. No statute sets a
                      growth rate, so we show a range around your estimate rather than a single number.
                    </p>
                  </Alert>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] border-collapse text-sm">
                      <caption className="sr-only">
                        Projected home equity after {result.projectionYears} years, at several yearly growth
                        rates
                      </caption>
                      <thead>
                        <tr className="border-b border-border text-left text-ink-muted">
                          <th scope="col" className="py-2 pr-4 font-medium">
                            Growth per year
                          </th>
                          <th scope="col" className="py-2 pr-4 font-medium">
                            Home value
                          </th>
                          <th scope="col" className="py-2 pr-4 font-medium">
                            Equity in {result.projectionYears} yr
                          </th>
                          <th scope="col" className="py-2 font-medium">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.projection.map((scenario) => (
                          <tr
                            key={scenario.annualAppreciationBps}
                            className={`border-b border-border ${
                              scenario.isUserSelected ? "bg-info-surface font-semibold text-info-text" : ""
                            }`}
                          >
                            <th scope="row" className="py-2 pr-4 text-left font-normal">
                              {(scenario.annualAppreciationBps / 100).toFixed(2)}%
                              {scenario.isUserSelected ? " (yours)" : ""}
                            </th>
                            <td className="py-2 pr-4">{formatMoney(scenario.finalYear.marketValueCents)}</td>
                            <td className="py-2 pr-4">{formatMoney(scenario.finalYear.equityCents)}</td>
                            <td className="py-2">
                              {scenario.finalYear.equityChangeFromTodayCents >= 0 ? "+" : "−"}
                              {formatMoney(Math.abs(scenario.finalYear.equityChangeFromTodayCents))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {userScenario ? (
                    <p className="text-sm text-ink-muted">
                      At your {(userScenario.annualAppreciationBps / 100).toFixed(2)}% estimate, equity goes
                      from {formatMoney(result.current.equityCents)} today to{" "}
                      {formatMoney(userScenario.finalYear.equityCents)} in {result.projectionYears} years.
                    </p>
                  ) : null}

                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-ink">
                      What this calculation assumed
                    </summary>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-ink-muted">
                      {result.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              ) : null}
            </div>
          </details>

          <Alert variant="info" role="note" className="text-sm">
            <p>
              This worksheet doesn&apos;t add anything to the estimate on its own. To include the home, add it
              as an item above using <strong>today&apos;s</strong> value, and add the mortgage as a separate
              debt.
            </p>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
