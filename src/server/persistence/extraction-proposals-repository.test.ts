import { describe, expect, it } from "vitest";

import {
  buildProposalTransitionQuery,
  isValidProposalTransition,
} from "./extraction-proposals-repository";
import { createUnconnectedTestDb } from "./test-db";

describe("extraction proposal confirmation transition", () => {
  it("only allows transitioning out of 'proposed'", () => {
    expect(isValidProposalTransition("proposed")).toBe(true);
    expect(isValidProposalTransition("confirmed")).toBe(false);
    expect(isValidProposalTransition("rejected")).toBe(false);
  });

  it("the confirm/reject update is a compare-and-swap requiring status = 'proposed'", () => {
    const db = createUnconnectedTestDb();
    const confirmQuery = buildProposalTransitionQuery(db, "proposal-1", "confirmed", 4200);
    const { sql, params } = confirmQuery.toSQL();

    expect(sql).toContain('"extraction_proposals"."status" =');
    expect(params).toContain("proposed");
    expect(params).toContain("confirmed");
  });

  it("rejecting sets status to 'rejected' and never sets a confirmedValue", () => {
    const db = createUnconnectedTestDb();
    const rejectQuery = buildProposalTransitionQuery(db, "proposal-1", "rejected", undefined);
    const { params } = rejectQuery.toSQL();

    expect(params).toContain("rejected");
    // The CAS guard still requires the row to currently be 'proposed'.
    expect(params).toContain("proposed");
    expect(params).not.toContain(4200);
  });

  it("confirming and rejecting the same proposal compile to different SQL parameters", () => {
    const db = createUnconnectedTestDb();
    const confirmParams = buildProposalTransitionQuery(db, "proposal-1", "confirmed", 1).toSQL()
      .params;
    const rejectParams = buildProposalTransitionQuery(db, "proposal-1", "rejected", undefined).toSQL()
      .params;

    expect(confirmParams).not.toEqual(rejectParams);
  });
});
