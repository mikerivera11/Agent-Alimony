import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ASSISTANT_DISCLAIMER,
  MAX_CONVERSATION_LENGTH,
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
    const emptyQuestion = parsed.error.issues.some(
      (issue) => issue.path[0] === "question" && issue.code === "too_small",
    );
    return errorResponse(
      400,
      "invalid_request",
      emptyQuestion
        ? "Type a question first."
        : `That's longer than this form accepts. Questions can be up to ${MAX_QUESTION_LENGTH.toLocaleString()} characters — try asking about the part you most need explained.`,
    );
  }

  // A per-message cap doesn't bound the request on its own: a full history of
  // maximum-length turns would still be enormous. Bound the conversation too.
  const conversationLength =
    parsed.data.question.length +
    parsed.data.history.reduce((total, message) => total + message.content.length, 0);
  if (conversationLength > MAX_CONVERSATION_LENGTH) {
    return errorResponse(
      400,
      "conversation_too_long",
      "This conversation has grown too long to send. Reload the page to start a fresh one — nothing is saved either way.",
    );
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
