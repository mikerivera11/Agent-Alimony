import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildReviewedDraft } from "@/domain/intake";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

import { POST } from "../route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/package/alimony-advance-agreement", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/package/alimony-advance-agreement", () => {
  it("returns the requested private PDF attachment", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());

    const response = await POST(postRequest({ reviewedDraft: reviewed }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "alimony-settlement-advance-credit-agreement.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(pdf.getTitle()).toContain("Alimony Settlement Advance and Credit Acknowledgment");
  });

  it("refuses to generate a document that the reviewed answers did not request", async () => {
    const draft = createSampleDraft();
    draft.data.alimonyAdvance = {
      wantsAdvanceAgreement: "no",
      payerFullLegalName: "",
      recipientFullLegalName: "",
      advanceAmount: 0,
      finalSettlementAmount: 0,
      creditMethod: "dollar_for_dollar",
      ifFinalAgreementNotEntered: "attorney_to_confirm",
      clearedFundsRequired: "yes",
    };
    const reviewed = buildReviewedDraft(draft);

    const response = await POST(postRequest({ reviewedDraft: reviewed }));

    expect(response.status).toBe(409);
    expect(await response.json()).toHaveProperty("error");
  });

  it("rejects unexpected payload keys", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());

    const response = await POST(
      postRequest({ reviewedDraft: reviewed, bindingAgreement: true }),
    );

    expect(response.status).toBe(400);
  });
});
