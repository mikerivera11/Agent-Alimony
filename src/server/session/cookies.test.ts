import { describe, expect, it } from "vitest";

import {
  buildClearedSessionCookie,
  buildSessionCookie,
  SESSION_COOKIE_NAME,
  serializeSessionCookie,
} from "./cookies";

/** `NODE_ENV` is typed read-only by Next.js's ambient types; this cast is test-only. */
function setNodeEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("session cookies", () => {
  it("builds an HttpOnly, SameSite=Lax cookie", () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const descriptor = buildSessionCookie("token-value", expiresAt);

    expect(descriptor.name).toBe(SESSION_COOKIE_NAME);
    expect(descriptor.value).toBe("token-value");
    expect(descriptor.attributes.httpOnly).toBe(true);
    expect(descriptor.attributes.sameSite).toBe("lax");
    expect(descriptor.attributes.path).toBe("/");
    expect(descriptor.attributes.expires).toBe(expiresAt);
  });

  it("is not secure outside production", () => {
    const original = process.env.NODE_ENV;
    setNodeEnv("development");
    try {
      const descriptor = buildSessionCookie("token-value", new Date());
      expect(descriptor.attributes.secure).toBe(false);
    } finally {
      setNodeEnv(original);
    }
  });

  it("is secure in production", () => {
    const original = process.env.NODE_ENV;
    setNodeEnv("production");
    try {
      const descriptor = buildSessionCookie("token-value", new Date());
      expect(descriptor.attributes.secure).toBe(true);
    } finally {
      setNodeEnv(original);
    }
  });

  it("serializes with HttpOnly and SameSite=Lax attributes present", () => {
    const header = serializeSessionCookie(buildSessionCookie("abc", new Date(Date.now() + 1000)));
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain(`${SESSION_COOKIE_NAME}=abc`);
  });

  it("clears the cookie with an already-expired date", () => {
    const descriptor = buildClearedSessionCookie();
    expect(descriptor.value).toBe("");
    expect(descriptor.attributes.expires.getTime()).toBeLessThan(Date.now());
  });
});
