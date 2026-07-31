import { getServerEnv } from "@/lib/env";

import type { StorageAdapter } from "./adapter";
import { AzureBlobStorageAdapter } from "./azure-adapter";
import { LocalFilesystemStorageAdapter } from "./local-adapter";

export * from "./adapter";
export * from "./object-key";
export * from "./upload-validation";
export * from "./reconciliation";
export { AzureBlobStorageAdapter } from "./azure-adapter";
export { LocalFilesystemStorageAdapter } from "./local-adapter";

/** Source documents are retained for exactly 7 days before reconciliation deletes them. */
export const SOURCE_DOCUMENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

let cachedAdapter: StorageAdapter | undefined;

/** Resolves the storage adapter selected by `STORAGE_PROVIDER`. */
export function getStorageAdapter(): StorageAdapter {
  if (!cachedAdapter) {
    const env = getServerEnv();
    if (env.STORAGE_PROVIDER === "azure") {
      if (!env.AZURE_STORAGE_ACCOUNT_NAME) {
        throw new Error("AZURE_STORAGE_ACCOUNT_NAME is required when STORAGE_PROVIDER=azure.");
      }
      cachedAdapter = new AzureBlobStorageAdapter({
        accountName: env.AZURE_STORAGE_ACCOUNT_NAME,
        sourceDocumentsContainer: env.AZURE_UPLOAD_CONTAINER,
        generatedPackagesContainer: env.AZURE_PACKAGE_CONTAINER,
      });
    } else {
      cachedAdapter = new LocalFilesystemStorageAdapter(env.LOCAL_STORAGE_PATH);
    }
  }
  return cachedAdapter;
}
