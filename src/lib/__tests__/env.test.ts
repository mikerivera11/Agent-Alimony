import { describe, expect, it } from "vitest";

import { __testing } from "../env";

const { serverEnvSchema } = __testing;

const REQUIRED = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  SESSION_SIGNING_SECRET: "x".repeat(32),
};

describe("serverEnvSchema", () => {
  it("parses a minimal environment and applies defaults", () => {
    const env = serverEnvSchema.parse(REQUIRED);

    expect(env.STORAGE_PROVIDER).toBe("local");
    expect(env.EXTRACTION_PROVIDER).toBe("mock");
    expect(env.ASSISTANT_PROVIDER).toBe("local");
    expect(env.MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it("treats a blank optional URL as not configured", () => {
    // `.env.example` ships these blank, so this is the common case rather
    // than an edge case: a bare `AZURE_KEY_VAULT_URL=` must not fail.
    const env = serverEnvSchema.parse({ ...REQUIRED, AZURE_KEY_VAULT_URL: "" });

    expect(env.AZURE_KEY_VAULT_URL).toBeUndefined();
  });

  it("treats every blank optional entry from .env.example as not configured", () => {
    const env = serverEnvSchema.parse({
      ...REQUIRED,
      AZURE_STORAGE_ACCOUNT_NAME: "",
      AZURE_KEY_VAULT_URL: "",
      AI_PROVIDER_API_KEY: "",
      AZURE_FOUNDRY_ENDPOINT: "",
      AZURE_FOUNDRY_DEPLOYMENT: "",
      AZURE_FOUNDRY_API_KEY: "",
    });

    expect(env.AZURE_STORAGE_ACCOUNT_NAME).toBeUndefined();
    expect(env.AZURE_KEY_VAULT_URL).toBeUndefined();
    expect(env.AI_PROVIDER_API_KEY).toBeUndefined();
    expect(env.AZURE_FOUNDRY_ENDPOINT).toBeUndefined();
    expect(env.AZURE_FOUNDRY_DEPLOYMENT).toBeUndefined();
    expect(env.AZURE_FOUNDRY_API_KEY).toBeUndefined();
  });

  it("falls back to the default when a defaulted entry is blank", () => {
    const env = serverEnvSchema.parse({
      ...REQUIRED,
      STORAGE_PROVIDER: "",
      APP_BASE_URL: "",
      MAX_UPLOAD_BYTES: "",
      ASSISTANT_PROVIDER: "",
    });

    expect(env.STORAGE_PROVIDER).toBe("local");
    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
    expect(env.MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(env.ASSISTANT_PROVIDER).toBe("local");
  });

  it("treats a whitespace-only entry as blank", () => {
    const env = serverEnvSchema.parse({ ...REQUIRED, AZURE_FOUNDRY_ENDPOINT: "   " });

    expect(env.AZURE_FOUNDRY_ENDPOINT).toBeUndefined();
  });

  it("still rejects a malformed value that is actually present", () => {
    expect(() => serverEnvSchema.parse({ ...REQUIRED, AZURE_KEY_VAULT_URL: "not-a-url" })).toThrow();
  });

  it("still requires DATABASE_URL and a long enough signing secret", () => {
    expect(() => serverEnvSchema.parse({ SESSION_SIGNING_SECRET: "x".repeat(32) })).toThrow();
    expect(() => serverEnvSchema.parse({ ...REQUIRED, SESSION_SIGNING_SECRET: "too-short" })).toThrow();
  });

  it("accepts a configured Foundry assistant", () => {
    const env = serverEnvSchema.parse({
      ...REQUIRED,
      ASSISTANT_PROVIDER: "foundry",
      AZURE_FOUNDRY_ENDPOINT: "https://example.services.ai.azure.com",
      AZURE_FOUNDRY_DEPLOYMENT: "claude-opus-5",
    });

    expect(env.ASSISTANT_PROVIDER).toBe("foundry");
    expect(env.AZURE_FOUNDRY_DEPLOYMENT).toBe("claude-opus-5");
  });

  it("rejects an unknown assistant provider", () => {
    expect(() => serverEnvSchema.parse({ ...REQUIRED, ASSISTANT_PROVIDER: "openai" })).toThrow();
  });
});
