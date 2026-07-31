import type { RuleOutcome } from "@/domain/rules";

interface RuleOutcomeStatusProps {
  outcome: Exclude<RuleOutcome<unknown>, { kind: "calculated" }>;
}

/**
 * Shared rendering for the three non-calculated `RuleOutcome` kinds
 * (`needsInput`, `notImplemented`, `requiresProfessionalReview`). Calculated
 * outcomes are rendered by each topic's own outcome card, since their
 * result shapes differ.
 */
export function RuleOutcomeStatus({ outcome }: RuleOutcomeStatusProps) {
  if (outcome.kind === "needsInput") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-md border-2 border-amber-700 bg-amber-50 p-4">
        <p className="font-semibold text-amber-950">{outcome.message}</p>
        {outcome.missingFacts.length > 0 && (
          <ul className="list-disc pl-6 text-amber-950">
            {outcome.missingFacts.map((fact) => (
              <li key={fact.factId}>{fact.description}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (outcome.kind === "notImplemented") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-slate-400 bg-slate-50 p-4 text-slate-900">
        <p className="font-semibold">Not available in this tool yet</p>
        <p>{outcome.reason}</p>
      </div>
    );
  }

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border-2 border-red-800 bg-red-50 p-4 text-red-950">
      <p className="font-semibold">Requires professional review</p>
      <p>{outcome.reason}</p>
      {outcome.flags.length > 0 && (
        <ul className="list-disc pl-6">
          {outcome.flags.map((flag) => (
            <li key={flag.flagId}>{flag.description}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
