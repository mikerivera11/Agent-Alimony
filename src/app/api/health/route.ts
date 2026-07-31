import packageJson from "../../../../package.json";

/**
 * GET /api/health
 *
 * App Service health-check endpoint (see infra/modules/app-service.bicep:
 * `healthCheckPath: '/api/health'`). Intentionally returns the smallest
 * possible payload:
 *  - a fixed `status` literal, never derived from environment/config state
 *  - the app version from package.json (public build metadata, not a
 *    secret)
 *
 * It never reads or echoes environment variables, connection strings, or
 * any other configuration value, so it is safe to poll from outside the
 * app (e.g. scripts/azure/smoke-test.sh) without exposing anything
 * sensitive. `Cache-Control: no-store` ensures every request reaches the
 * live process rather than a cached response.
 */
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function GET(): Response {
  return Response.json(
    {
      status: "ok",
      version: packageJson.version,
    },
    { headers: NO_STORE_HEADERS },
  );
}
