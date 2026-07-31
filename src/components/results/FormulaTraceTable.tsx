import type { FormulaStep } from "@/domain/rules";

interface FormulaTraceTableProps {
  steps: readonly FormulaStep[];
}

function formatValue(value: string | number | boolean | null): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Renders a preserved, step-by-step calculation trace so every number is traceable. */
export function FormulaTraceTable({ steps }: FormulaTraceTableProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">Formula trace</caption>
      <thead>
        <tr className="border-b-2 border-border-strong text-xs uppercase tracking-wide text-ink-subtle">
          <th scope="col" className="py-1.5 pr-3">
            Step
          </th>
          <th scope="col" className="py-1.5 pr-3">
            Values
          </th>
          <th scope="col" className="py-1.5">
            Citation
          </th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step) => (
          <tr key={step.stepId} className="border-b border-border align-top">
            <td className="py-2 pr-3 text-ink">{step.description}</td>
            <td className="py-2 pr-3 text-ink-muted">
              <ul className="flex flex-col gap-0.5">
                {Object.entries(step.values).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-medium">{key}:</span>{" "}
                    <span className="tabular-nums">{formatValue(value)}</span>
                  </li>
                ))}
              </ul>
            </td>
            <td className="py-2 text-xs text-ink-subtle">{step.citation ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
