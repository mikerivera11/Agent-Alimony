import { describe, expect, it } from "vitest";

import { buildReviewedDraft } from "@/domain/intake";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

import { POST } from "../route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/scenario", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function reviewedDraft() {
  return buildReviewedDraft(createSampleDraft());
}

describe("POST /api/scenario", () => {
  it("recalculates with the override and marks the result hypothetical", async () => {
    const response = await POST(
      postRequest({
        reviewedDraft: reviewedDraft(),
        overrides: { selfMonthlyGrossIncomeCents: 900_000 },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.scenario.isHypothetical).toBe(true);
    expect(body.scenario.childSupport.kind).toBe("calculated");
    expect(body.scenario.childSupport.result.parents[0].monthlyGrossIncomeCents).toBe(900_000);
  });

  it("never caches a what-if", async () => {
    const response = await POST(
      postRequest({
        reviewedDraft: reviewedDraft(),
        overrides: { selfAnnualOvernights: 180 },
      }),
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("says which values it used, so a misread number is visible", async () => {
    const response = await POST(
      postRequest({
        reviewedDraft: reviewedDraft(),
        overrides: { selfMonthlyGrossIncomeCents: 900_000 },
      }),
    );

    const body = await response.json();
    const applied = body.scenario.appliedOverrides;
    expect(applied).toHaveLength(1);
    expect(applied[0].toCents).toBe(900_000);
    expect(applied[0].fromCents).not.toBe(900_000);
  });

  it("rejects a what-if that changes nothing", async () => {
    const response = await POST(postRequest({ reviewedDraft: reviewedDraft(), overrides: {} }));

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
  });

  it("rejects an impossible number of overnights instead of calculating one", async () => {
    const response = await POST(
      postRequest({ reviewedDraft: reviewedDraft(), overrides: { selfAnnualOvernights: 400 } }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a negative income", async () => {
    const response = await POST(
      postRequest({ reviewedDraft: reviewedDraft(), overrides: { selfMonthlyGrossIncomeCents: -1 } }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a figure supplied by the client instead of an override", async () => {
    // The client must never be able to state an outcome. Anything that is not
    // a recognised override is refused rather than ignored.
    const response = await POST(
      postRequest({
        reviewedDraft: reviewedDraft(),
        overrides: { monthlyTransferAmountCents: 1 },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
  });
});
