import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { DEMO_DOCUMENT_SHA256, MockExtractionAdapter } from "@/server/extraction";

import type { ApiErrorResponse, DemoExtractionApiResponse } from "@/components/documents/apiContracts";

/**
 * Runs the *fictional* demo extraction. This never touches an uploaded file
 * — it always invokes `MockExtractionAdapter` with the hardcoded
 * `DEMO_DOCUMENT_SHA256` (the one designated demo fixture) and freshly
 * generated UUIDs. Every proposal returned here is fictional example data
 * and must be labeled as such wherever it is rendered.
 */

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function errorResponse(status: number, code: string, message: string): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(): Promise<NextResponse<DemoExtractionApiResponse>> {
  try {
    const documentId = randomUUID();
    const adapter = new MockExtractionAdapter();
    const result = await adapter.run({
      documentId,
      caseId: randomUUID(),
      sessionId: randomUUID(),
      sha256: DEMO_DOCUMENT_SHA256,
      detectedMimeType: "application/pdf",
    });

    const body: DemoExtractionApiResponse = {
      ok: true,
      document: { documentId },
      extraction: {
        status: result.status,
        isDemo: result.isDemo,
        adapterLabel: adapter.label,
        proposals: result.proposals,
      },
    };

    return NextResponse.json(body, { status: 200, headers: NO_STORE_HEADERS });
  } catch {
    return errorResponse(500, "demo_extraction_failed", "The fictional demo extraction could not run.");
  }
}
