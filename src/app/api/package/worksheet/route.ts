import { buildPackageViewModel } from "@/domain/package";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import {
  buildWorksheet,
  generateWorksheetPdf,
  packageRequestSchema,
  WORKSHEET_FILENAMES,
  WORKSHEET_IDS,
  type WorksheetId,
} from "@/server/package";

/**
 * POST /api/package/worksheet?form=<id>
 *
 * Same contract as `/api/package`: the client sends confirmed input facts, and
 * the server re-validates and recalculates everything. The client never
 * supplies a figure that ends up on a worksheet.
 *
 * Returns 409 rather than an empty PDF when a worksheet cannot be built — a
 * child support worksheet with no calculation behind it is a page of blanks
 * that looks exactly like a form somebody could file.
 */
export async function POST(request: Request): Promise<Response> {
  const formParam = new URL(request.url).searchParams.get("form");
  if (!formParam || !WORKSHEET_IDS.includes(formParam as WorksheetId)) {
    return Response.json(
      { error: `Unknown worksheet. Expected one of: ${WORKSHEET_IDS.join(", ")}.` },
      { status: 400 },
    );
  }
  const worksheetId = formParam as WorksheetId;

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
        error: "Invalid worksheet request payload.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 },
    );
  }

  const draft = parsed.data.reviewedDraft as ReviewedIntakeDraft;
  const viewModel = buildPackageViewModel(draft);
  const worksheet = buildWorksheet(worksheetId, viewModel, draft);

  if (!worksheet) {
    return Response.json(
      {
        error:
          "This worksheet cannot be produced from the information on file yet. Complete the related section and " +
          "generate an estimate first.",
      },
      { status: 409 },
    );
  }

  const pdfBytes = await generateWorksheetPdf(worksheet);

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${WORKSHEET_FILENAMES[worksheetId]}"`,
      "Cache-Control": "no-store",
    },
  });
}
