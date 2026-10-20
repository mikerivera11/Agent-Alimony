import { describe, expect, it } from "vitest";

import { buildReviewedDraft } from "@/domain/intake";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

import { POST } from "../route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/package/court-forms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/package/court-forms", () => {
  it("returns populated official forms as a private PDF attachment", async () => {
    const response = await POST(
      postRequest({ reviewedDraft: buildReviewedDraft(createSampleDraft()) }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "populated-florida-court-forms-review-draft.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100_000);
  });

  it("requires the opt-in filing details", async () => {
    const draft = createSampleDraft();
    draft.data.filingDetails = { wantsFilingPacket: "no" };

    const response = await POST(
      postRequest({ reviewedDraft: buildReviewedDraft(draft) }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toHaveProperty("error");
  });

  it("returns a partially populated download when an applicable answer is unresolved", async () => {
    const draft = createSampleDraft();
    if (!draft.data.filingDetails.spouse) throw new Error("Expected sample spouse details.");
    draft.data.filingDetails.spouse.emailAddress = "";

    const response = await POST(
      postRequest({ reviewedDraft: buildReviewedDraft(draft) }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100_000);
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/package/court-forms", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
  });
});
