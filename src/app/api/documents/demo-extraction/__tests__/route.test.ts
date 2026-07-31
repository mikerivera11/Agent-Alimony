import { describe, expect, it } from "vitest";

import { POST } from "../route";

describe("POST /api/documents/demo-extraction", () => {
  it("returns fictional demo proposals labeled as demo, with no-store headers", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.extraction.isDemo).toBe(true);
    expect(body.extraction.status).toBe("completed");
    expect(body.extraction.adapterLabel.toLowerCase()).toContain("demo");
    expect(body.extraction.proposals.length).toBeGreaterThan(0);

    for (const proposal of body.extraction.proposals) {
      expect(typeof proposal.fieldKey).toBe("string");
      expect(proposal.confidence).toBeGreaterThanOrEqual(0);
      expect(proposal.confidence).toBeLessThanOrEqual(1);
      // Adapter proposals never carry a smuggled "status" (e.g. "confirmed").
      expect(Object.prototype.hasOwnProperty.call(proposal, "status")).toBe(false);
    }
  });

  it("uses a freshly generated document id on each call (never reuses a real document identity)", async () => {
    const first = await (await POST()).json();
    const second = await (await POST()).json();
    expect(first.document.documentId).not.toBe(second.document.documentId);
  });
});
