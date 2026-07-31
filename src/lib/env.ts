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
