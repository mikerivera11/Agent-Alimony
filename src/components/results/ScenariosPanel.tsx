import type { PackageScenario } from "@/domain/package";

interface ScenariosPanelProps {
  scenarios: readonly PackageScenario[];
}

/** Illustrative what-if scenarios, only ever built from an already-calculated outcome. */
export function ScenariosPanel({ scenarios }: ScenariosPanelProps) {
  if (scenarios.length === 0) {
    return (
      <p className="text-slate-700">
        No illustrative scenarios are available yet — scenarios only appear once a calculation is complete.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {scenarios.map((scenario) => (
        <li key={scenario.scenarioId} className="flex flex-col gap-2 rounded-lg border border-slate-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{scenario.topic}</p>
          <h3 className="font-semibold text-slate-950">{scenario.title}</h3>
          <p className="text-sm text-slate-700">{scenario.description}</p>
          <dl className="flex flex-col gap-1">
            {Object.entries(scenario.figures).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2 text-sm">
                <dt className="text-slate-600">{label}</dt>
                <dd className="font-medium text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
