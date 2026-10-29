import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { createEmptyDraft } from "@/domain/intake";

import { POST } from "../route";

function requestFor(draft: unknown): Request {
  return new Request("http://localhost/api/package/court-forms-preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft }),
  });
}

describe("POST /api/package/court-forms-preview", () => {
  it("generates official forms from answers currently saved in a partial draft", async () => {
    const draft = createEmptyDraft();
    draft.data.caseBasics.caseType = "with_children";
    draft.data.children = {
      hasChildren: "yes",
      children: [{ id: "child-1", nameOrInitials: "Z.", dateOfBirth: "", hasSpecialNeeds: "no" }],
    };
    draft.data.spouses = {
      yourRole: "not_sure",
      yourNameOrInitials: "M.R.",
      spouseNameOrInitials: "L.",
    };
    draft.data.filingDetails = {
      wantsFilingPacket: "yes",
      you: { fullLegalName: "Mike Rivera", dateOfBirth: undefined, address: {} },
      spouse: { fullLegalName: "Leticia", dateOfBirth: undefined, address: {} },
      children: [{ childId: "child-1", fullLegalName: "Zyan", residences: [] }],
    };
    draft.data.settlementTerms = {
      taxExemptionTerms: "The parties may file jointly only by mutual agreement.",
      otherSettlementTerms: "Vehicle lease terms are reported for attorney review.",
      unresolvedIssues: "Lease expiration date remains unresolved.",
    };

    const response = await POST(requestFor(draft));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "currently-populated-florida-court-forms-review-draft.pdf",
    );
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(pdf.getTitle()).toBe("Populated Florida Court Forms — Review Draft");
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("requires the filing-packet opt-in", async () => {
    const draft = createEmptyDraft();
    draft.data.filingDetails.wantsFilingPacket = "no";

    const response = await POST(requestFor(draft));

    expect(response.status).toBe(409);
  });
});
