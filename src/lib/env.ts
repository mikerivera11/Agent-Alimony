import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SIGNING_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_PROVIDER: z.enum(["local", "azure"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default(".data/uploads"),
  AZURE_STORAGE_ACCOUNT_NAME: z.string().optional(),
  AZURE_UPLOAD_CONTAINER: z.string().default("case-documents"),
  AZURE_PACKAGE_CONTAINER: z.string().default("generated-packages"),
  AZURE_KEY_VAULT_URL: z.string().url().optional(),
  EXTRACTION_PROVIDER: z.enum(["mock", "configured"]).default("mock"),
  AI_PROVIDER_API_KEY: z.string().optional(),
  // Florida family-law information assistant. `local` answers from the
  // curated statute knowledge base with no AI provider and is the default.
  ASSISTANT_PROVIDER: z.enum(["local", "foundry"]).default("local"),
  /** e.g. https://<resource>.services.ai.azure.com */
  AZURE_FOUNDRY_ENDPOINT: z.string().url().optional(),
  /** Foundry model deployment name, e.g. claude-opus-5. */
  AZURE_FOUNDRY_DEPLOYMENT: z.string().optional(),
  /** Optional. Prefer managed identity with the Cognitive Services User role. */
  AZURE_FOUNDRY_API_KEY: z.string().optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = serverEnvSchema.parse(process.env);
  }
  return cachedEnv;
}
