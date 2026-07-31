/** Thrown when a case/document lookup succeeds but does not belong to the requesting session. Repositories should generally prefer *not finding* the row (return null/undefined) over throwing this, so callers can respond 404 rather than leaking existence — this class exists for call sites that need to distinguish the two internally (e.g. audit logging). */
export class OwnershipError extends Error {
  constructor(message = "The requested resource does not belong to this session.") {
    super(message);
    this.name = "OwnershipError";
  }
}

/** Thrown when an optimistic-concurrency compare-and-swap affects zero rows because the caller's expected revision is stale. */
export class ConcurrencyConflictError extends Error {
  constructor(message = "The record was modified by another request. Reload and retry.") {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}

/** Thrown when a proposal state transition is attempted from an invalid source status. */
export class InvalidProposalTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProposalTransitionError";
  }
}
