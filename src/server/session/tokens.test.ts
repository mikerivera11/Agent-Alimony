import { describe, expect, it } from "vitest";

process.env.SESSION_SIGNING_SECRET = "test-session-signing-secret-value-32chars-min";
process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
process.env.APP_BASE_URL = "http://localhost:3000";

const {
  generateOpaqueSecret,
  hashOpaqueSecret,
  secretMatchesHash,
  signSessionToken,
  verifySessionTokenSignature,
  SessionTokenError,
} = await import("./tokens");

describe("session tokens", () => {
  it("round-trips a freshly signed token", async () => {
    const secret = generateOpaqueSecret();
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await signSessionToken({ sessionId: "session-1", secret }, expiresAt);

    const payload = await verifySessionTokenSignature(token);
    expect(payload.sessionId).toBe("session-1");
    expect(payload.secret).toBe(secret);
  });

  it("rejects a token with a tampered payload segment", async () => {
    const secret = generateOpaqueSecret();
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await signSessionToken({ sessionId: "session-1", secret }, expiresAt);

    const [header, payload, signature] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.sid = "attacker-controlled-session-id";
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    await expect(verifySessionTokenSignature(tamperedToken)).rejects.toThrow(SessionTokenError);
  });

  it("rejects a token with a tampered signature", async () => {
    const secret = generateOpaqueSecret();
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await signSessionToken({ sessionId: "session-1", secret }, expiresAt);

    const [header, payload, signature] = token.split(".");
    const flippedChar = signature[0] === "A" ? "B" : "A";
    const tamperedToken = `${header}.${payload}.${flippedChar}${signature.slice(1)}`;

    await expect(verifySessionTokenSignature(tamperedToken)).rejects.toThrow(SessionTokenError);
  });

  it("rejects a token signed under a different secret entirely", async () => {
    const bogusToken =
      "eyJhbGciOiJIUzI1NiJ9.eyJzaWQiOiJhdHRhY2tlciIsInNlYyI6ImZvcmdlZCJ9.not-a-real-signature";
    await expect(verifySessionTokenSignature(bogusToken)).rejects.toThrow(SessionTokenError);
  });

  it("rejects an expired token even with a valid signature", async () => {
    const secret = generateOpaqueSecret();
    const expiresAt = new Date(Date.now() - 60_000); // already expired
    const token = await signSessionToken({ sessionId: "session-1", secret }, expiresAt);

    await expect(verifySessionTokenSignature(token)).rejects.toThrow(SessionTokenError);
  });

  it("rejects malformed tokens (wrong number of segments, garbage input)", async () => {
    await expect(verifySessionTokenSignature("not-a-jwt")).rejects.toThrow(SessionTokenError);
    await expect(verifySessionTokenSignature("")).rejects.toThrow(SessionTokenError);
  });

  it("hashes are one-way and stable for the same input", () => {
    const secret = generateOpaqueSecret();
    const hash1 = hashOpaqueSecret(secret);
    const hash2 = hashOpaqueSecret(secret);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(secret);
  });

  it("secretMatchesHash accepts the correct secret and rejects any other", () => {
    const secret = generateOpaqueSecret();
    const hash = hashOpaqueSecret(secret);
    expect(secretMatchesHash(secret, hash)).toBe(true);
    expect(secretMatchesHash(generateOpaqueSecret(), hash)).toBe(false);
  });

  it("secretMatchesHash safely rejects mismatched-length hashes without throwing", () => {
    const secret = generateOpaqueSecret();
    expect(secretMatchesHash(secret, "short")).toBe(false);
  });

  it("two generated secrets are never equal (sufficient randomness)", () => {
    const secrets = new Set(Array.from({ length: 50 }, () => generateOpaqueSecret()));
    expect(secrets.size).toBe(50);
  });
});
