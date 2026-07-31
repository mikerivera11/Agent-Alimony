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
        <span className="text-xs font-medium text-slate-500">
          Status: <span className="font-semibold text-slate-800">{decision.status}</span>
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-700">Field</dt>
          <dd className="text-slate-900">{proposal.fieldKey}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Proposed value</dt>
          <dd className="text-slate-900">
            {isEditing ? (
              <label className="flex flex-col gap-1">
                <span className="sr-only">Edit value for {proposal.fieldKey}</span>
                <input
                  type="text"
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  className="min-h-11 w-full rounded-md border border-slate-400 px-2 py-1 text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </label>
            ) : (
              formatProposedValue(decision.editedValue ?? proposal.value)
            )}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Source document</dt>
          <dd className="text-slate-900">{proposal.sourceDocumentId}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Page</dt>
          <dd className="text-slate-900">{proposal.sourcePage ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Confidence</dt>
          <dd className="text-slate-900">{Math.round(proposal.confidence * 100)}%</dd>
        </div>
        {proposal.sourceLocation?.note ? (
          <div>
            <dt className="font-semibold text-slate-700">Provenance note</dt>
            <dd className="text-slate-900">{proposal.sourceLocation.note}</dd>
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
