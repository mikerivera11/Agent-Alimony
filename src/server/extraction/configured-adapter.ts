import { getServerEnv } from "@/lib/env";

import { ExtractionProviderUnavailableError } from "./adapter";
import type { ExtractionAdapter, ExtractionAdapterResult, ExtractionRunInput } from "./adapter";

/**
 * Boundary stub for an externally-configured extraction provider. This MVP
 * boundary intentionally implements no real network integration: it errors
 * clearly and immediately rather than silently falling back to mock
 * behavior or pretending a real extraction occurred. Wiring an actual
 * provider is a future, explicit change to this file — not a default.
 */
export class ConfiguredExtractionAdapter implements ExtractionAdapter {
  readonly name = "configured";
  readonly label = "Configured Extraction Provider (not implemented in this deployment)";

  async run(_input: ExtractionRunInput): Promise<ExtractionAdapterResult> {
    const env = getServerEnv();
    if (!env.AI_PROVIDER_API_KEY) {
      throw new ExtractionProviderUnavailableError(
        "EXTRACTION_PROVIDER=configured requires AI_PROVIDER_API_KEY to be set.",
      );
    }
    throw new ExtractionProviderUnavailableError(
      "A configured extraction provider is not implemented in this deployment. " +
        "Set EXTRACTION_PROVIDER=mock, or implement a real provider integration here.",
    );
  }
}
