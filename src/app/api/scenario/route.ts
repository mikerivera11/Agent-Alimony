import { z } from "zod";

import type { ReviewedIntakeDraft } from "@/domain/intake";
import { EmptyScenarioError, calculateScenario } from "@/domain/scenario";
import { packageRequestSchema } from "@/server/package";

/**
 * POST /api/scenario
 *
 * "What would this be if I earned nine thousand instead?"
 *
 * Same contract as the package routes — the client sends its reviewed answers
 * and the server recalculates — with two differences that matter:
 *
 * - **Nothing is persisted.** A what-if is not part of anyone's case. It is
 *   computed, returned, and forgotten, exactly like the assistant endpoint.
 * - **The response is explicitly hypothetical.** The figures come from the
 *   same deterministic Florida calculators as the real estimate, but the
 *   inputs carry the `conversational-scenario` provenance, so nothing
 *   downstream can save or print them as though the person had confirmed them.
 *
 * The client never sends a figure and the response never contains prose. The
 * app renders the numbers itself, which is what keeps "every dollar figure in
 * this app comes from the deterministic calculators, never from the
 * assistant" literally true even when the question was asked in a chat.
 */

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Loose enough for a real answer, tight enough that nothing absurd reaches the engine. */
const MAX_MONTHLY_INCOME_CENTS = 100_000_000; // $1,000,000 per month
const NIGHTS_IN_YEAR = 365;

const scenarioRequestSchema = packageRequestSchema.extend({
  overrides: z
    .object({
      selfMonthlyGrossIncomeCents: z.number().int().min(0).max(MAX_MONTHLY_INCOME_CENTS).optional(),
      spouseMonthlyGrossIncomeCents: z.number().int().min(0).max(MAX_MONTHLY_INCOME_CENTS).optional(),
      selfAnnualOvernights: z.number().int().min(0).max(NIGHTS_IN_YEAR).optional(),
    })
    // Strict, not stripping: an unrecognised key is a caller trying to state
    // something the engine decides. Refuse it loudly instead of ignoring it.
    .strict(),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = scenarioRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid scenario request payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const draft = parsed.data.reviewedDraft as ReviewedIntakeDraft;

  try {
    const result = calculateScenario(draft, parsed.data.overrides);
    return Response.json({ ok: true, scenario: result }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof EmptyScenarioError) {
      return Response.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS });
    }
    throw error;
  }
}
