import type { ProposedFieldValue } from "@/server/extraction";

/**
 * Local, browser-only tracking of a user's decision about each extraction
 * proposal (confirm / edit / reject). This is deliberately NOT wired to any
 * calculation engine — storing a decision here never "feeds" a formula. It
 * only remembers what the person chose so the UI can show it back to them.
 */

export const PROPOSAL_DECISIONS_STORAGE_KEY =
  "florida-support-guide.documents.proposal-decisions.v1";

export type ProposalDecisionStatus = "proposed" | "editing" | "confirmed" | "rejected";

export interface ProposalDecisionRecord {
  /** Stable local identifier for this proposal (not a server/database id). */
  proposalId: string;
  fieldKey: string;
  /** The value as originally proposed by the adapter. Never mutated. */
  originalValue: ProposedFieldValue;
  /** The value while being edited or after being confirmed with edits. Null when unused. */
  editedValue: ProposedFieldValue | null;
  status: ProposalDecisionStatus;
  /** ISO timestamp of the last confirm/reject decision, or null if still undecided. */
  decidedAt: string | null;
}

export type ProposalDecisionsState = Record<string, ProposalDecisionRecord>;

export type ProposalDecisionAction =
  | { type: "start_edit" }
  | { type: "update_edit_value"; value: ProposedFieldValue }
  | { type: "cancel_edit" }
  | { type: "confirm"; value?: ProposedFieldValue }
  | { type: "reject" }
  | { type: "reset" };

/**
 * Creates the initial (undecided) record for a freshly received proposal.
 * Every proposal starts life as `"proposed"` — never pre-confirmed.
 */
export function createProposalDecisionRecord(
  proposalId: string,
  fieldKey: string,
  value: ProposedFieldValue,
): ProposalDecisionRecord {
  return {
    proposalId,
    fieldKey,
    originalValue: value,
    editedValue: null,
    status: "proposed",
    decidedAt: null,
  };
}

const VALID_TRANSITIONS: Record<ProposalDecisionStatus, ProposalDecisionAction["type"][]> = {
  proposed: ["start_edit", "confirm", "reject"],
  editing: ["update_edit_value", "cancel_edit", "confirm", "reject"],
  confirmed: ["reset", "start_edit", "reject"],
  rejected: ["reset", "start_edit"],
};

/**
 * Pure reducer for a single proposal's decision lifecycle. Never called
 * automatically — every transition requires an explicit user action
 * dispatched from the UI (there is no code path that confirms a proposal
 * without a corresponding button press).
 */
export function transitionProposalDecision(
  record: ProposalDecisionRecord,
  action: ProposalDecisionAction,
): ProposalDecisionRecord {
  const allowed = VALID_TRANSITIONS[record.status];
  if (!allowed.includes(action.type)) {
    // Ignore actions that don't make sense in the current state (e.g.
    // double-submitting) rather than throwing or silently "succeeding".
    return record;
  }

  const now = new Date().toISOString();

  switch (action.type) {
    case "start_edit":
      return { ...record, status: "editing", editedValue: record.editedValue ?? record.originalValue };
    case "update_edit_value":
      return { ...record, status: "editing", editedValue: action.value };
    case "cancel_edit":
      return { ...record, status: "proposed", editedValue: null };
    case "confirm":
      return {
        ...record,
        status: "confirmed",
        editedValue: action.value !== undefined ? action.value : record.editedValue,
        decidedAt: now,
      };
    case "reject":
      return { ...record, status: "rejected", decidedAt: now };
    case "reset":
      return { ...record, status: "proposed", editedValue: null, decidedAt: null };
    default:
      return record;
  }
}

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/** Serializes decision state to a JSON string. Extracted for direct testing of the storage format. */
export function serializeProposalDecisions(state: ProposalDecisionsState): string {
  return JSON.stringify(state);
}

/** Parses a previously-serialized decision state. Returns an empty state on any malformed input rather than throwing. */
export function deserializeProposalDecisions(raw: string): ProposalDecisionsState {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ProposalDecisionsState;
    }
    return {};
  } catch {
    return {};
  }
}

/** Loads all proposal decisions from localStorage. Never throws; returns `{}` when unavailable or unreadable. */
export function loadProposalDecisions(): ProposalDecisionsState {
  if (!isBrowserStorageAvailable()) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PROPOSAL_DECISIONS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return deserializeProposalDecisions(raw);
  } catch {
    return {};
  }
}

/** Persists all proposal decisions to localStorage. Never throws (private browsing/quota failures are swallowed). */
export function saveProposalDecisions(state: ProposalDecisionsState): void {
  if (!isBrowserStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.setItem(PROPOSAL_DECISIONS_STORAGE_KEY, serializeProposalDecisions(state));
  } catch {
    // Ignore — the UI keeps working in-memory for the rest of the session.
  }
}

/** Clears all locally-stored proposal decisions. */
export function clearProposalDecisions(): void {
  if (!isBrowserStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.removeItem(PROPOSAL_DECISIONS_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
