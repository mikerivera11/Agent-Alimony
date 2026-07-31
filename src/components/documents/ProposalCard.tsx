"use client";

import { useState } from "react";

import type { ExtractionProposalDTO } from "./apiContracts";
import type { ProposalDecisionAction, ProposalDecisionRecord } from "./proposalStorage";
import { coerceEditedValue, formatProposedValue } from "./proposalValueFormat";
import { badgeClasses, cardClasses, dangerButtonClasses, primaryButtonClasses, secondaryButtonClasses } from "./styles";

interface ProposalCardProps {
  proposal: ExtractionProposalDTO;
  decision: ProposalDecisionRecord;
  onAction: (action: ProposalDecisionAction) => void;
}

/**
 * Renders a single extraction proposal for explicit human review. Every
 * proposal is always labeled "DEMO DATA ONLY" — nothing rendered by this
 * component is ever confirmed automatically; every status change requires
 * pressing Confirm, Edit, or Reject.
 */
export function ProposalCard({ proposal, decision, onAction }: ProposalCardProps) {
  const [draftText, setDraftText] = useState(() => formatProposedValue(decision.editedValue ?? proposal.value));

  const isEditing = decision.status === "editing";

  return (
    <li className={cardClasses}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={badgeClasses}>Demo data only</span>
        <span className="text-xs font-medium text-ink-subtle">
          Status: <span className="font-semibold text-ink-muted">{decision.status}</span>
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ink-muted">Field</dt>
          <dd className="text-ink">{proposal.fieldKey}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">Proposed value</dt>
          <dd className="text-ink">
            {isEditing ? (
              <label className="flex flex-col gap-1">
                <span className="sr-only">Edit value for {proposal.fieldKey}</span>
                <input
                  type="text"
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-field-border bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ) : (
              formatProposedValue(decision.editedValue ?? proposal.value)
            )}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">Source document</dt>
          <dd className="text-ink">{proposal.sourceDocumentId}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">Page</dt>
          <dd className="text-ink">{proposal.sourcePage ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">Confidence</dt>
          <dd className="text-ink">{Math.round(proposal.confidence * 100)}%</dd>
        </div>
        {proposal.sourceLocation?.note ? (
          <div>
            <dt className="font-semibold text-ink-muted">Provenance note</dt>
            <dd className="text-ink">{proposal.sourceLocation.note}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              className={primaryButtonClasses}
              onClick={() => onAction({ type: "confirm", value: coerceEditedValue(proposal.value, draftText) })}
            >
              Save &amp; confirm edit
            </button>
            <button
              type="button"
              className={secondaryButtonClasses}
              onClick={() => {
                setDraftText(formatProposedValue(proposal.value));
                onAction({ type: "cancel_edit" });
              }}
            >
              Cancel edit
            </button>
          </>
        ) : (
          <>
            <button type="button" className={primaryButtonClasses} onClick={() => onAction({ type: "confirm" })}>
              Confirm
            </button>
            <button
              type="button"
              className={secondaryButtonClasses}
              onClick={() => {
                setDraftText(formatProposedValue(decision.editedValue ?? proposal.value));
                onAction({ type: "start_edit" });
              }}
            >
              Edit
            </button>
            <button type="button" className={dangerButtonClasses} onClick={() => onAction({ type: "reject" })}>
              Reject
            </button>
          </>
        )}
        {decision.status === "confirmed" || decision.status === "rejected" ? (
          <button type="button" className={secondaryButtonClasses} onClick={() => onAction({ type: "reset" })}>
            Undo decision
          </button>
        ) : null}
      </div>
    </li>
  );
}
