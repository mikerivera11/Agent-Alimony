import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ASSISTANT_DISCLAIMER,
  MAX_HISTORY_TURNS,
  MAX_QUESTION_LENGTH,
  getAssistantAdapter,
} from "@/server/assistant";

/**
 * Q&A endpoint for the Florida family-law information assistant.
 *
 * Deliberately stateless: conversation history is supplied by the client and
 * nothing is persisted. Questions here routinely contain sensitive financial
 * and family details, so the least-retention default is to keep none of it,
 * and nothing from the request or the answer is ever logged.
 */

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const requestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
      }),
    )
    .max(MAX_HISTORY_TURNS)
    .default([]),
});

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "The request body could not be read.");
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", `Ask a question of up to ${MAX_QUESTION_LENGTH} characters.`);
  }

  try {
    const adapter = getAssistantAdapter();
    const answer = await adapter.answer({
      question: parsed.data.question,
      history: parsed.data.history,
    });

    return NextResponse.json(
      { ok: true, answer, disclaimer: ASSISTANT_DISCLAIMER },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    // The error is intentionally not logged: it can carry the question text.
    return errorResponse(500, "assistant_failed", "The assistant could not answer just now. Please try again.");
  }
}
