import { afterEach, describe, expect, it, vi } from "vitest";

import { runDemoExtraction, uploadDocument } from "../apiClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadDocument", () => {
  it("returns the parsed success response when the request succeeds", async () => {
    const payload = { ok: true, document: { documentId: "d1" }, extraction: { proposals: [] } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );

    const result = await uploadDocument(new File(["abc"], "a.pdf", { type: "application/pdf" }));
    expect(result).toEqual(payload);
  });

  it("never fabricates a success result when the network request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const result = await uploadDocument(new File(["abc"], "a.pdf", { type: "application/pdf" }));
    expect(result.ok).toBe(false);
  });

  it("never fabricates a success result when the response body is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>not json</html>", { status: 200 })),
    );

    const result = await uploadDocument(new File(["abc"], "a.pdf", { type: "application/pdf" }));
    expect(result.ok).toBe(false);
  });
});

describe("runDemoExtraction", () => {
  it("never fabricates a success result on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const result = await runDemoExtraction();
    expect(result.ok).toBe(false);
  });
});
