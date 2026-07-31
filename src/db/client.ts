import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getServerEnv } from "@/lib/env";

import * as schema from "./schema";

/**
 * Lazily-created singleton Postgres connection + Drizzle client. This module
 * must never be imported by client (browser) bundles: `getServerEnv()` throws
 * synchronously if invoked outside a Node.js server runtime, and every
 * connection string is read exclusively from validated server env (see
 * src/lib/env.ts) — never from browser-supplied input.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "src/db/client.ts is server-only and must not be imported from browser code.",
  );
}

let cachedClient: postgres.Sql | undefined;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!cachedDb) {
    const env = getServerEnv();
    cachedClient = postgres(env.DATABASE_URL, { max: 10 });
    cachedDb = drizzle(cachedClient, { schema });
  }
  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.end({ timeout: 5 });
    cachedClient = undefined;
    cachedDb = undefined;
  }
}

export type Database = ReturnType<typeof getDb>;

export { schema };
