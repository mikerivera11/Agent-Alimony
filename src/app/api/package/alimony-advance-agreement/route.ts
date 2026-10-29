import type { ReviewedIntakeDraft } from "@/domain/intake";
import { generateAlimonyAdvanceAgreementPdf, packageRequestSchema } from "@/server/package";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = packageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid alimony advance agreement request payload.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 },
    );
  }

  const draft = parsed.data.reviewedDraft as ReviewedIntakeDraft;
  if (draft.data.alimonyAdvance?.wantsAdvanceAgreement !== "yes") {
    return Response.json(
      {
        error:
          "No housing advance agreement was requested. Turn it on in the Pre-judgment housing advance section.",
      },
      { status: 409 },
    );
  }

  const pdfBytes = await generateAlimonyAdvanceAgreementPdf(draft);
  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="pre-judgment-housing-advance-credit-agreement.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
