import { buildFilingReadiness, buildSettlementTermSheet } from "@/domain/forms";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import { buildPackageViewModel } from "@/domain/package";
import { generateFilingPacketPdf, packageRequestSchema } from "@/server/package";

/**
 * POST /api/package/filing-packet
 *
 * Same contract as the other package routes: the client sends confirmed input
 * facts and the server re-validates and recalculates. Nothing on the packet is
 * a figure the client supplied.
 *
 * Returns 409 when the packet was never requested, rather than producing a
 * document full of blanks that looks like an attorney could work from it.
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
        error: "Invalid filing packet request payload.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 },
    );
  }

  const draft = parsed.data.reviewedDraft as ReviewedIntakeDraft;
  const viewModel = buildPackageViewModel(draft);

  // The date the residency arithmetic is measured against is the server's, not
  // the client's: whether a six-month requirement is met must not be movable
  // by a browser clock.
  const generatedAt = viewModel.generatedAt;
  const readiness = buildFilingReadiness({ data: draft.data, asOfIso: generatedAt.slice(0, 10) });

  if (!readiness.requested) {
    return Response.json(
      {
        error:
          "The attorney filing packet was not requested, so the details it needs were never collected. Turn it on in " +
          "the 'Attorney filing packet' section of your answers.",
      },
      { status: 409 },
    );
  }

  const termSheet = buildSettlementTermSheet({
    data: draft.data,
    packageViewModel: viewModel,
    generatedAt,
  });

  const pdfBytes = await generateFilingPacketPdf({ readiness, termSheet });

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="attorney-filing-packet.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
