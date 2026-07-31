import { getServerEnv } from "@/lib/env";

import type { ExtractionAdapter } from "./adapter";
import { ConfiguredExtractionAdapter } from "./configured-adapter";
import { MockExtractionAdapter } from "./mock-adapter";

export * from "./adapter";
export * from "./facts";
export * from "./schemas";
export { ConfiguredExtractionAdapter } from "./configured-adapter";
export { DEMO_DOCUMENT_MARKER, DEMO_DOCUMENT_SHA256, MockExtractionAdapter } from "./mock-adapter";

/** Resolves the adapter selected by `EXTRACTION_PROVIDER`. Defaults to the mock adapter. */
export function getExtractionAdapter(): ExtractionAdapter {
  const env = getServerEnv();
  switch (env.EXTRACTION_PROVIDER) {
    case "configured":
      return new ConfiguredExtractionAdapter();
    case "mock":
    default:
      return new MockExtractionAdapter();
  }
}
