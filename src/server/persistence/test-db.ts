import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

/**
 * Builds a real Drizzle client pointed at an address that is never actually
 * connected to. `postgres-js` connects lazily, and Drizzle's query builders
 * can be compiled to SQL text via `.toSQL()` without awaiting/executing
 * them — so this is sufficient to structurally assert that repository
 * queries carry the correct ownership-scoping and concurrency predicates,
 * without requiring a live Postgres instance in this environment.
 */
export function createUnconnectedTestDb() {
  const client = postgres("postgres://user:pass@127.0.0.1:1/unused", {
    max: 1,
    connect_timeout: 1,
  });
  return drizzle(client, { schema });
}
