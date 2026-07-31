import type { RuleOutcome } from "@/domain/rules";

import { Alert } from "@/components/ui";

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
      <Alert variant="warning" role="status" title={outcome.message}>
        {outcome.missingFacts.length > 0 && (
          <ul className="list-disc pl-6">
            {outcome.missingFacts.map((fact) => (
              <li key={fact.factId}>{fact.description}</li>
            ))}
          </ul>
        )}
      </Alert>
    );
  }

  if (outcome.kind === "notImplemented") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border-strong bg-surface-2 p-4 text-ink">
        <p className="font-semibold">Not available in this tool yet</p>
        <p>{outcome.reason}</p>
      </div>
    );
  }

  return (
    <Alert variant="danger" role="alert" title="Requires professional review">
      <p>{outcome.reason}</p>
      {outcome.flags.length > 0 && (
        <ul className="list-disc pl-6">
          {outcome.flags.map((flag) => (
            <li key={flag.flagId}>{flag.description}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
