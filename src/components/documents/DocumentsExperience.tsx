"use client";

import { useCallback, useState } from "react";

import { DemoExtractionPanel } from "./DemoExtractionPanel";
import { ProposalReviewList, type RegisteredProposal } from "./ProposalReviewList";
import { UploadPanel } from "./UploadPanel";
import type { ExtractionProposalDTO } from "./apiContracts";
import {
  createProposalDecisionRecord,
  loadProposalDecisions,
  saveProposalDecisions,
  transitionProposalDecision,
  type ProposalDecisionAction,
  type ProposalDecisionsState,
} from "./proposalStorage";

function generateProposalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Orchestrates the upload panel, the fictional demo-extraction action, and
 * the shared proposal review list. This is the only place that reads/writes
 * the localStorage-backed proposal decisions — both panels report their
 * results up to here rather than managing storage themselves, so a single
 * namespaced key is always the source of truth.
 *
 * Confirming or rejecting a proposal here only updates local browser
 * storage; nothing in this component (or anywhere in `documents/**`) feeds
 * a proposal into a calculation engine.
 */
export function DocumentsExperience() {
  const [proposals, setProposals] = useState<RegisteredProposal[]>([]);
  // Lazy initializer: reads any previously-saved decisions once on mount.
  // Safe during server rendering too (returns `{}` when `window` is
  // unavailable) since no JSX below depends on this map until `proposals`
  // (which always starts empty) is populated by an explicit user action.
  const [decisions, setDecisions] = useState<ProposalDecisionsState>(() => loadProposalDecisions());

  const registerProposals = useCallback((newProposals: ExtractionProposalDTO[]) => {
    if (newProposals.length === 0) {
      return;
    }

    const registered: RegisteredProposal[] = newProposals.map((dto) => ({
      proposalId: generateProposalId(),
      dto,
    }));

    setProposals((prev) => [...prev, ...registered]);
    setDecisions((prev) => {
      const next = { ...prev };
      for (const { proposalId, dto } of registered) {
        next[proposalId] = createProposalDecisionRecord(proposalId, dto.fieldKey, dto.value);
      }
      saveProposalDecisions(next);
      return next;
    });
  }, []);

  const dispatchDecision = useCallback((proposalId: string, action: ProposalDecisionAction) => {
    setDecisions((prev) => {
      const current = prev[proposalId];
      if (!current) {
        return prev;
      }
      const updated = transitionProposalDecision(current, action);
      const next = { ...prev, [proposalId]: updated };
      saveProposalDecisions(next);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <UploadPanel onProposals={registerProposals} />
      <DemoExtractionPanel onProposals={registerProposals} />
      <ProposalReviewList proposals={proposals} decisions={decisions} onAction={dispatchDecision} />
    </div>
  );
}
