/**
 * Storage adapter interface + shared types. Keeps the rest of the app
 * decoupled from *how* bytes are persisted (local filesystem in dev, Azure
 * Blob Storage in production) — callers only ever deal with opaque,
 * randomized object keys, never filesystem paths or user-controlled names.
 *
 * Two logical containers are modeled:
 * - "source-documents": user uploads. Subject to a 7-day retention window
 *   (see `sourceExpiresAt` and src/server/storage/reconciliation.ts).
 * - "generated-packages": app-generated output artifacts. Not subject to
 *   the source retention window and kept in a physically separate
 *   container/prefix so a bug in source cleanup can never delete output.
 */
export type StorageContainer = "source-documents" | "generated-packages";

export interface StorageWriteMetadata {
  contentType: string;
  /** Required for "source-documents" writes; ignored for "generated-packages". */
  sourceExpiresAt?: Date;
}

export interface StorageWriteResult {
  /** Randomized, opaque object key. Never derived from user input (filenames, ids, etc). */
  objectKey: string;
}

export interface StorageAdapter {
  readonly provider: "local" | "azure";
  write(
    container: StorageContainer,
    data: Buffer,
    metadata: StorageWriteMetadata,
  ): Promise<StorageWriteResult>;
  read(container: StorageContainer, objectKey: string): Promise<Buffer>;
  delete(container: StorageContainer, objectKey: string): Promise<void>;
  exists(container: StorageContainer, objectKey: string): Promise<boolean>;
}

/** Thrown for any objectKey that fails structural validation (e.g. path traversal attempts). Never resolved to a filesystem/blob path. */
export class InvalidObjectKeyError extends Error {
  constructor(message = "Invalid storage object key.") {
    super(message);
    this.name = "InvalidObjectKeyError";
  }
}
