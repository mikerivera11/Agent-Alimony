/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resetServerEnvCache } from "@/lib/env";

import {
  MAX_CONVERSATION_LENGTH,
  MAX_HISTORY_TURNS,
  MAX_QUESTION_LENGTH,
} from "@/lib/assistantLimits";

import { POST } from "../route";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function json(response: Response) {
  return (await response.json()) as {
    ok: boolean;
    error?: { code: string; message: string };
  };
}

describe("assistant request limits", () => {
  // The route resolves the adapter through `getServerEnv()`, which requires a
  // valid server environment. Nothing here reaches a provider: the default
  // assistant adapter answers from the local knowledge base.
  beforeAll(() => {
    process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/fsg_test";
    process.env.SESSION_SIGNING_SECRET ??= "a".repeat(32);
    resetServerEnvCache();
  });

  afterAll(() => {
    resetServerEnvCache();
  });

  it("accepts a question far longer than a person would type by hand", async () => {
    // The point of raising the ceiling: pasting several paragraphs out of a
    // court order or a financial affidavit must not be rejected.
    const question = `How does Florida handle alimony? ${"Here is more context about my case. ".repeat(300)}`;
    expect(question.length).toBeGreaterThan(8_000);

    const response = await post({ question });

    expect(response.status).toBe(200);
    expect((await json(response)).ok).toBe(true);
  });

  it("accepts a question at exactly the ceiling", async () => {
    expect((await post({ question: "a".repeat(MAX_QUESTION_LENGTH) })).status).toBe(200);
  });

  it("names the real limit when a question is past the ceiling", async () => {
    const response = await post({ question: "a".repeat(MAX_QUESTION_LENGTH + 1) });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("invalid_request");
    expect(body.error?.message).toContain(MAX_QUESTION_LENGTH.toLocaleString());
  });

  it("asks for a question rather than complaining about length when nothing was typed", async () => {
    const body = await json(await post({ question: "   " }));
    expect(body.error?.message).toBe("Type a question first.");
  });

  it("bounds the whole conversation, not just each message", async () => {
    // A per-message cap alone leaves the request unbounded: a full history of
    // maximum-length turns is still an enormous body.
    const long = "a".repeat(MAX_QUESTION_LENGTH);
    const history = Array.from({ length: MAX_HISTORY_TURNS }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: long,
    }));
    expect(history.length * long.length).toBeGreaterThan(MAX_CONVERSATION_LENGTH);

    const response = await post({ question: "And what about alimony?", history });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("conversation_too_long");
  });

  it("allows a normal multi-turn conversation", async () => {
    const history = Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: "A normal length message about Florida alimony.",
    }));

    const response = await post({ question: "How is child support calculated?", history });

    expect(response.status).toBe(200);
  });
});
