import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { describe, expect, it } from "vitest";

import { buildReviewedDraft, } from "@/domain/intake";

import { POST } from "../route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/package", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/package", () => {
  it("returns an attachment PDF with no-store headers for a valid reviewed-draft payload", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());
    const response = await POST(postRequest({ reviewedDraft: reviewed }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const buffer = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(buffer.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("rejects malformed JSON with a 400 and no PDF body", async () => {
    const response = await POST(
      new Request("http://localhost/api/package", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not valid json",
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).not.toBe("application/pdf");
  });

  it("rejects a payload carrying an extraneous field instead of silently accepting it", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());
    const response = await POST(
      postRequest({ reviewedDraft: reviewed, htmlOverride: "<script>alert(1)</script>" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a payload missing required reviewed-draft topics", async () => {
    const response = await POST(postRequest({ reviewedDraft: { draftId: "x", reviewedAt: "x", isDemo: false, data: {} } }));
    expect(response.status).toBe(400);
  });
});
