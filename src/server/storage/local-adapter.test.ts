import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { InvalidObjectKeyError } from "./adapter";
import { LocalFilesystemStorageAdapter } from "./local-adapter";

const testRoots: string[] = [];

function makeAdapter(): LocalFilesystemStorageAdapter {
  const root = path.join(process.cwd(), ".data", `vitest-storage-${randomUUID()}`);
  testRoots.push(root);
  return new LocalFilesystemStorageAdapter(root);
}

afterEach(async () => {
  while (testRoots.length > 0) {
    const root = testRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

describe("LocalFilesystemStorageAdapter", () => {
  it("writes and reads back the same bytes via a randomized object key", async () => {
    const adapter = makeAdapter();
    const data = Buffer.from("hello world");
    const { objectKey } = await adapter.write("source-documents", data, {
      contentType: "text/plain",
      sourceExpiresAt: new Date(Date.now() + 1000),
    });

    expect(objectKey).not.toContain("hello");
    expect(await adapter.exists("source-documents", objectKey)).toBe(true);
    const readBack = await adapter.read("source-documents", objectKey);
    expect(readBack.equals(data)).toBe(true);
  });

  it("never uses any caller-supplied value to construct the object key", async () => {
    const adapter = makeAdapter();
    const { objectKey: keyA } = await adapter.write("source-documents", Buffer.from("a"), {
      contentType: "text/plain",
    });
    const { objectKey: keyB } = await adapter.write("source-documents", Buffer.from("a"), {
      contentType: "text/plain",
    });
    // Identical content and metadata still produce different, random keys.
    expect(keyA).not.toBe(keyB);
  });

  it("deletes an object so it is no longer readable or present", async () => {
    const adapter = makeAdapter();
    const { objectKey } = await adapter.write("source-documents", Buffer.from("data"), {
      contentType: "text/plain",
    });
    await adapter.delete("source-documents", objectKey);
    expect(await adapter.exists("source-documents", objectKey)).toBe(false);
    await expect(adapter.read("source-documents", objectKey)).rejects.toThrow();
  });

  it("keeps source-documents and generated-packages in separate containers", async () => {
    const adapter = makeAdapter();
    const { objectKey } = await adapter.write("source-documents", Buffer.from("source"), {
      contentType: "text/plain",
    });
    // The same key must not resolve to content in the other container.
    expect(await adapter.exists("generated-packages", objectKey)).toBe(false);
  });

  describe("path traversal resistance", () => {
    it("rejects a read for a key containing '..' segments", async () => {
      const adapter = makeAdapter();
      await expect(adapter.read("source-documents", "../../../../etc/passwd")).rejects.toThrow(
        InvalidObjectKeyError,
      );
    });

    it("rejects a delete for a key containing '..' segments", async () => {
      const adapter = makeAdapter();
      await expect(adapter.delete("source-documents", "../../secrets")).rejects.toThrow(
        InvalidObjectKeyError,
      );
    });

    it("rejects an absolute-path-style key", async () => {
      const adapter = makeAdapter();
      await expect(adapter.read("source-documents", "/etc/passwd")).rejects.toThrow(
        InvalidObjectKeyError,
      );
    });

    it("rejects a key with the wrong segment count even without traversal characters", async () => {
      const adapter = makeAdapter();
      await expect(adapter.read("source-documents", "onlyonesegment")).rejects.toThrow(
        InvalidObjectKeyError,
      );
    });

    it("rejects a key containing null bytes or other unsafe characters", async () => {
      const adapter = makeAdapter();
      await expect(adapter.read("source-documents", "ab/cd/ef\u0000gh")).rejects.toThrow(
        InvalidObjectKeyError,
      );
    });

    it("cannot escape the storage root even via a crafted key that survives naive path.join", async () => {
      const adapter = makeAdapter();
      // path.join(root, "aa/bb/../../../../etc/passwd") would normally escape root;
      // assertValidObjectKey must reject this before it ever reaches path resolution.
      await expect(
        adapter.read("source-documents", "aa/bb/../../../../etc/passwd"),
      ).rejects.toThrow(InvalidObjectKeyError);
    });

    it("a real write always produces a resolvable path strictly inside the container root", async () => {
      const adapter = makeAdapter();
      const { objectKey } = await adapter.write("source-documents", Buffer.from("x"), {
        contentType: "text/plain",
      });
      // Confirm the file genuinely lives under .data/<root>/source-documents/...
      const root = testRoots[testRoots.length - 1];
      const expectedPath = path.join(root!, "source-documents", objectKey);
      const content = await readFile(expectedPath);
      expect(content.toString()).toBe("x");
    });
  });
});
