import { describe, expect, it } from "vitest";

import { buildReviewedDraft } from "@/domain/intake";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

import { POST } from "../route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/package/filing-packet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/package/filing-packet", () => {
  it("returns an attachment PDF that is not cached", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());

    const response = await POST(postRequest({ reviewedDraft: reviewed }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    // The packet contains full legal names and home addresses, so it must
    // never sit in a shared cache.
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it("refuses rather than producing a blank packet when it was not requested", async () => {
    const draft = createSampleDraft();
    draft.data.filingDetails = { wantsFilingPacket: "no" };
    const reviewed = buildReviewedDraft(draft);

    const response = await POST(postRequest({ reviewedDraft: reviewed }));

    expect(response.status).toBe(409);
    expect(await response.json()).toHaveProperty("error");
  });

  it("rejects a payload carrying an unexpected key", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());

    const response = await POST(
      postRequest({ reviewedDraft: reviewed, precomputedResult: { monthlyTransferAmountCents: 1 } }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/package/filing-packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
  });
});
