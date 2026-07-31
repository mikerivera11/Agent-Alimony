import type { DemoExtractionApiResponse, UploadApiResponse } from "./apiContracts";

/**
 * Thin fetch wrappers around the `/api/documents/*` routes. Centralized so
 * every caller handles network failures and malformed responses the same
 * (safe, generic) way — no code path here ever synthesizes a success-shaped
 * result when a request actually failed.
 */

const GENERIC_NETWORK_ERROR: UploadApiResponse & DemoExtractionApiResponse = {
  ok: false,
  error: { code: "network_error", message: "The request could not be completed. Please try again." },
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    // A non-JSON or empty body still means we cannot claim success.
    return GENERIC_NETWORK_ERROR as unknown as T;
  }
}

export async function uploadDocument(file: File): Promise<UploadApiResponse> {
  const formData = new FormData();
  formData.set("file", file);

  try {
    const response = await fetch("/api/documents/upload", { method: "POST", body: formData });
    return await parseJsonResponse<UploadApiResponse>(response);
  } catch {
    return GENERIC_NETWORK_ERROR;
  }
}

export async function runDemoExtraction(): Promise<DemoExtractionApiResponse> {
  try {
    const response = await fetch("/api/documents/demo-extraction", { method: "POST" });
    return await parseJsonResponse<DemoExtractionApiResponse>(response);
  } catch {
    return GENERIC_NETWORK_ERROR;
  }
}
