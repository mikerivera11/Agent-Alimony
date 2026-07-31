import { describe, expect, it } from "vitest";

import { buildReviewedDraft } from "@/domain/intake";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

import { POST } from "../route";

function postRequest(form: string | null, body: unknown): Request {
  const url =
    form === null
      ? "http://localhost/api/package/worksheet"
      : `http://localhost/api/package/worksheet?form=${form}`;
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/package/worksheet", () => {
  it("returns an attachment PDF for each supported worksheet", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());

    for (const form of ["child-support-guidelines", "parenting-plan"]) {
      const response = await POST(postRequest(form, { reviewedDraft: reviewed }));

      expect(response.status, form).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("content-disposition")).toContain("attachment");
      expect(response.headers.get("cache-control")).toBe("no-store");

      const buffer = new Uint8Array(await response.arrayBuffer());
      expect(Buffer.from(buffer.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    }
  });

  it("rejects an unknown or missing form id rather than guessing one", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());
    for (const form of [null, "", "financial-affidavit"]) {
      const response = await POST(postRequest(form, { reviewedDraft: reviewed }));
      expect(response.status, String(form)).toBe(400);
      expect(response.headers.get("content-type")).toContain("application/json");
    }
  });

  it("rejects a payload that carries a precomputed figure instead of confirmed answers", async () => {
    const response = await POST(
      postRequest("child-support-guidelines", { monthlyTransferAmountCents: 91_500 }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 409 rather than an empty worksheet when the plan does not apply", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());
    // A household with no shared minor children has no parenting plan to lay
    // out. The route must say so rather than emit a page of blanks that looks
    // like a form somebody could sign.
    const withoutChildren = {
      ...reviewed,
      data: {
        ...reviewed.data,
        children: { ...reviewed.data.children, hasChildren: "no", children: [] },
      },
    };

    const response = await POST(postRequest("parenting-plan", { reviewedDraft: withoutChildren }));
    expect(response.status).toBe(409);
    expect(await response.json()).toHaveProperty("error");
  });
});
