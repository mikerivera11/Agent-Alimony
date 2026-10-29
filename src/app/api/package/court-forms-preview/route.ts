import { z } from "zod";

import { buildFilingReadiness } from "@/domain/forms";
import { normalizeDraft, type IntakeDraft, type ReviewedIntakeDraft } from "@/domain/intake";
import { generateOfficialCourtFormsPdf } from "@/server/package";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 1_000_000;

const requestSchema = z
  .object({
    draft: z
      .object({
        draftId: z.string().trim().min(1).max(200),
        createdAt: z.string().trim().min(1).max(100),
        updatedAt: z.string().trim().min(1).max(100),
        completedStepIds: z.array(z.string().trim().max(100)).max(50),
        lastScreenId: z.string().trim().max(100).optional(),
        data: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const declaredContentLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredContentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "The saved draft is too large to preview." }, { status: 413 });
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES) {
    return Response.json({ error: "The saved draft is too large to preview." }, { status: 413 });
  }
  const parsed = requestSchema.safeParse(
    (() => {
      try {
        return JSON.parse(body) as unknown;
      } catch {
        return null;
      }
    })(),
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid saved draft." }, { status: 400 });
  }

  const draft = normalizeDraft(parsed.data.draft as unknown as IntakeDraft);
  const reviewed = {
    draftId: draft.draftId,
    reviewedAt: new Date().toISOString(),
    data: draft.data,
  } as ReviewedIntakeDraft;
  const readiness = buildFilingReadiness({
    data: draft.data,
    asOfIso: new Date().toISOString().slice(0, 10),
  });

  if (!readiness.requested) {
    return Response.json(
      { error: "Turn on the attorney filing packet before downloading court forms." },
      { status: 409 },
    );
  }

  try {
    const pdfBytes = await generateOfficialCourtFormsPdf({
      draft: reviewed,
      readiness,
    });
    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="currently-populated-florida-court-forms-review-draft.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Court-form preview generation failed.", error);
    return Response.json(
      {
        error:
          "The current saved answers could not be placed into the official forms. Review the filing details and try again.",
      },
      { status: 422 },
    );
  }
}
