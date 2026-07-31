import { buildPackageViewModel } from "@/domain/package";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import { generatePackagePdf, packageRequestSchema } from "@/server/package";

/**
 * POST /api/package
 *
 * Accepts a strictly-validated reviewed-intake payload (never a
 * pre-computed outcome, never raw HTML), regenerates the full package view
 * model from scratch on the server using the same pure mappers/rulesets the
 * client uses, and streams back a downloadable, non-cached PDF. The client
 * is never trusted to supply calculated figures — only the confirmed input
 * facts, which are re-validated and re-calculated here.
 */
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
        error: "Invalid package request payload.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 },
    );
  }

  const viewModel = buildPackageViewModel(parsed.data.reviewedDraft as ReviewedIntakeDraft);
  const pdfBytes = await generatePackagePdf(viewModel);

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="florida-support-estimate.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
