import { buildFilingReadiness } from "@/domain/forms";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import { buildPackageViewModel } from "@/domain/package";
import { generateOfficialCourtFormsPdf, packageRequestSchema } from "@/server/package";

export const runtime = "nodejs";

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
        error: "Invalid court forms request payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const draft = parsed.data.reviewedDraft as ReviewedIntakeDraft;
  const viewModel = buildPackageViewModel(draft);
  const readiness = buildFilingReadiness({
    data: draft.data,
    asOfIso: viewModel.generatedAt.slice(0, 10),
  });
  if (!readiness.requested) {
    return Response.json(
      {
        error:
          "Populated court forms require the opt-in filing details. Turn on the attorney filing packet and confirm those answers first.",
      },
      { status: 409 },
    );
  }
  const pdfBytes = await generateOfficialCourtFormsPdf({ draft, readiness, viewModel });
  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="populated-florida-court-forms-review-draft.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
