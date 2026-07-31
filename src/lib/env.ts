import { z } from "zod";

/**
 * Environment variables are strings or nothing, and a variable that is
 * present-but-empty (`FOO=` in a .env file) is the normal way to write "not
 * configured". Zod's `.optional()` accepts `undefined` but not `""`, so a
 * blank optional entry would otherwise fail validation and take the whole
 * app down at the first `getServerEnv()` call — which is exactly what
 * `.env.example` invites, since it ships every optional Azure setting blank.
 * These helpers normalise an empty or whitespace-only value to `undefined`
 * before validating, so a blank entry behaves the same as an absent one.
 */
function emptyStringAsUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema,
  );
}

const optionalString = () => emptyStringAsUndefined(z.string().optional());
const optionalUrl = () => emptyStringAsUndefined(z.string().url().optional());

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SIGNING_SECRET: z.string().min(32),
  APP_BASE_URL: emptyStringAsUndefined(z.string().url().default("http://localhost:3000")),
  STORAGE_PROVIDER: emptyStringAsUndefined(z.enum(["local", "azure"]).default("local")),
  LOCAL_STORAGE_PATH: emptyStringAsUndefined(z.string().default(".data/uploads")),
  AZURE_STORAGE_ACCOUNT_NAME: optionalString(),
  AZURE_UPLOAD_CONTAINER: emptyStringAsUndefined(z.string().default("case-documents")),
  AZURE_PACKAGE_CONTAINER: emptyStringAsUndefined(z.string().default("generated-packages")),
  AZURE_KEY_VAULT_URL: optionalUrl(),
  EXTRACTION_PROVIDER: emptyStringAsUndefined(z.enum(["mock", "configured"]).default("mock")),
  AI_PROVIDER_API_KEY: optionalString(),
  // Florida family-law information assistant. `local` answers from the
  // curated statute knowledge base with no AI provider and is the default.
  ASSISTANT_PROVIDER: emptyStringAsUndefined(z.enum(["local", "foundry"]).default("local")),
  /** e.g. https://<resource>.services.ai.azure.com */
  AZURE_FOUNDRY_ENDPOINT: optionalUrl(),
  /** Foundry model deployment name, e.g. claude-opus-5. */
  AZURE_FOUNDRY_DEPLOYMENT: optionalString(),
  /** Optional. Prefer managed identity with the Cognitive Services User role. */
  AZURE_FOUNDRY_API_KEY: optionalString(),
  MAX_UPLOAD_BYTES: emptyStringAsUndefined(z.coerce.number().int().positive().default(10 * 1024 * 1024)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = serverEnvSchema.parse(process.env);
  }
  return cachedEnv;
}

/** Test-only: clears the memoized environment between cases. */
export function resetServerEnvCache(): void {
  cachedEnv = undefined;
}

export const __testing = { serverEnvSchema };
