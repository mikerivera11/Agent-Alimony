import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  StorageAdapter,
  StorageContainer,
  StorageWriteMetadata,
  StorageWriteResult,
} from "./adapter";
import { InvalidObjectKeyError } from "./adapter";
import { assertValidObjectKey, generateObjectKey } from "./object-key";

const CONTAINER_DIR_NAMES: Record<StorageContainer, string> = {
  "source-documents": "source-documents",
  "generated-packages": "generated-packages",
};

/**
 * Development-oriented filesystem storage adapter. Safe against path
 * traversal in two independent layers:
 *  1. Object keys are always server-generated (see object-key.ts) and
 *     structurally validated before use.
 *  2. Every resolved path is re-verified to be a descendant of the
 *     container root directory before any filesystem operation — so even a
 *     future bug that passed an attacker-influenced key through would still
 *     be caught here rather than escaping the storage root.
 * Content-type/expiry metadata is kept in a small sidecar JSON file next to
 * the object; this adapter never writes anything to the application
 * database.
 */
export class LocalFilesystemStorageAdapter implements StorageAdapter {
  readonly provider = "local" as const;
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  private containerRoot(container: StorageContainer): string {
    return path.join(this.rootDir, CONTAINER_DIR_NAMES[container]);
  }

  /** Resolves an object key to an absolute path, verifying it does not escape the container root. */
  private resolvePath(container: StorageContainer, objectKey: string): string {
    assertValidObjectKey(objectKey);
    const root = this.containerRoot(container);
    const resolved = path.resolve(root, objectKey);
    const relative = path.relative(root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new InvalidObjectKeyError();
    }
    return resolved;
  }

  private metadataPath(dataPath: string): string {
    return `${dataPath}.meta.json`;
  }

  async write(
    container: StorageContainer,
    data: Buffer,
    metadata: StorageWriteMetadata,
  ): Promise<StorageWriteResult> {
    const objectKey = generateObjectKey();
    const dataPath = this.resolvePath(container, objectKey);
    await mkdir(path.dirname(dataPath), { recursive: true });

    // Write-then-rename avoids leaving a partially-written object visible under its final name.
    const tmpPath = `${dataPath}.${randomUUID()}.tmp`;
    await writeFile(tmpPath, data, { mode: 0o600 });
    await rename(tmpPath, dataPath);

    await writeFile(
      this.metadataPath(dataPath),
      JSON.stringify({
        contentType: metadata.contentType,
        sourceExpiresAt: metadata.sourceExpiresAt?.toISOString() ?? null,
      }),
      { mode: 0o600 },
    );

    return { objectKey };
  }

  async read(container: StorageContainer, objectKey: string): Promise<Buffer> {
    const dataPath = this.resolvePath(container, objectKey);
    return readFile(dataPath);
  }

  async delete(container: StorageContainer, objectKey: string): Promise<void> {
    const dataPath = this.resolvePath(container, objectKey);
    await rm(dataPath, { force: true });
    await rm(this.metadataPath(dataPath), { force: true });
  }

  async exists(container: StorageContainer, objectKey: string): Promise<boolean> {
    const dataPath = this.resolvePath(container, objectKey);
    try {
      await stat(dataPath);
      return true;
    } catch {
      return false;
    }
  }
}
