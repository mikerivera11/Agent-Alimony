"use client";

import type { ExtractionProposalDTO } from "./apiContracts";
import { ProposalCard } from "./ProposalCard";
import type { ProposalDecisionAction, ProposalDecisionsState } from "./proposalStorage";

export interface RegisteredProposal {
  proposalId: string;
  dto: ExtractionProposalDTO;
}

interface ProposalReviewListProps {
  proposals: RegisteredProposal[];
  decisions: ProposalDecisionsState;
  onAction: (proposalId: string, action: ProposalDecisionAction) => void;
}

/**
 * Renders every extraction proposal collected so far (from the demo action
 * and/or, in the rare case a real upload's hash matched the demo fixture,
 * an upload). Always requires an explicit Confirm/Edit/Reject per proposal
 * — nothing here ever auto-advances a decision.
 */
export function ProposalReviewList({ proposals, decisions, onAction }: ProposalReviewListProps) {
  if (proposals.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="proposal-review-heading" className="flex flex-col gap-3">
      <h2 id="proposal-review-heading" className="text-xl font-semibold text-slate-950">
        Review proposed fields
      </h2>
      <p className="text-sm text-slate-700">
        Every proposal below is <strong>demo data only</strong>. Review the field, value, and source, then choose
        Confirm, Edit, or Reject for each one. Your choice is saved only in this browser and is never used to run a
        calculation automatically.
      </p>
      <ul className="flex flex-col gap-3">
        {proposals.map(({ proposalId, dto }) => {
          const decision = decisions[proposalId];
          if (!decision) {
            return null;
          }
          return (
            <ProposalCard
              key={proposalId}
              proposal={dto}
              decision={decision}
              onAction={(action) => onAction(proposalId, action)}
            />
          );
        })}
      </ul>
    </section>
  );
}
