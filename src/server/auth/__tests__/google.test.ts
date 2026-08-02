import { beforeAll, describe, expect, it } from "vitest";

import { sanitiseRedirectPath } from "../google";

beforeAll(() => {
  process.env.DATABASE_URL ??= ["postgres:/", "u:p@localhost:5432", "unused"].join("/");
  process.env.SESSION_SIGNING_SECRET ??= "x".repeat(32);
  process.env.APP_BASE_URL ??= "https://fsg.example";
});

/**
 * The callback returns the browser to a path the *caller* supplied when the
 * flow started. If that value were ever allowed to be absolute, this endpoint
 * would become an open redirect on an authentication URL — the exact shape
 * used to make a phishing link look like it came from the real site.
 */
describe("sanitiseRedirectPath", () => {
  it("keeps ordinary in-app paths", () => {
    expect(sanitiseRedirectPath("/intake?step=income")).toBe("/intake?step=income");
    expect(sanitiseRedirectPath("/results")).toBe("/results");
  });

  it("rejects absolute URLs", () => {
    expect(sanitiseRedirectPath("https://evil.example/steal")).toBe("/");
    expect(sanitiseRedirectPath("http://evil.example")).toBe("/");
  });

  it("rejects protocol-relative URLs, which browsers treat as absolute", () => {
    expect(sanitiseRedirectPath("//evil.example/steal")).toBe("/");
  });

  it("rejects backslash paths, which the URL parser normalises to another origin", () => {
    // `/\evil.example` looks relative to a naive check but resolves to
    // https://evil.example/ — this is the case a leading-character test misses.
    expect(sanitiseRedirectPath("/\\evil.example")).toBe("/");
    expect(sanitiseRedirectPath("/\\\\evil.example")).toBe("/");
    expect(sanitiseRedirectPath("/\\/evil.example")).toBe("/");
  });

  it("never returns anything that resolves off-origin", () => {
    const hostile = [
      "/\\evil.example",
      "//evil.example",
      "https://evil.example",
      "/\\\tevil.example",
      "/..//evil.example",
      "/./..//evil.example",
      "/foo/../..//evil.example",
    ];
    for (const candidate of hostile) {
      const result = sanitiseRedirectPath(candidate);
      expect(new URL(result, "https://fsg.example").origin).toBe("https://fsg.example");
    }
  });

  it("rejects schemes that are not http at all", () => {
    expect(sanitiseRedirectPath("javascript:alert(1)")).toBe("/");
    expect(sanitiseRedirectPath("data:text/html,<script>")).toBe("/");
  });

  it("falls back to the home page for missing or empty values", () => {
    expect(sanitiseRedirectPath(null)).toBe("/");
    expect(sanitiseRedirectPath(undefined)).toBe("/");
    expect(sanitiseRedirectPath("")).toBe("/");
  });
});
