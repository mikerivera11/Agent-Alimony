import { randomBytes } from "node:crypto";

import { InvalidObjectKeyError } from "./adapter";

/**
 * Every segment is derived purely from random bytes rendered as base64url
 * (alphabet: A-Z a-z 0-9 - _), so the key is inherently free of path
 * separators, dots, or any character that could be used for traversal —
 * independent of anything user-supplied.
 */
const OBJECT_KEY_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Generates a fully random, non-user-controlled object key, sharded into two
 * short prefix directories to keep any single directory from growing
 * unbounded. Never incorporates a filename, document id, or any other
 * caller-supplied value.
 */
export function generateObjectKey(): string {
  const random = randomBytes(32).toString("base64url");
  return `${random.slice(0, 2)}/${random.slice(2, 4)}/${random.slice(4)}`;
}

/**
 * Validates that an object key is exactly the shape this module generates:
 * a small, fixed number of path segments, each matching the random-charset
 * pattern above, with no ".." or empty segments. Storage adapters must call
 * this before resolving any key to a filesystem path or blob name — this is
 * the primary defense against path traversal even though, in normal
 * operation, no caller-supplied key ever reaches an adapter.
 */
export function assertValidObjectKey(objectKey: string): void {
  if (typeof objectKey !== "string" || objectKey.length === 0 || objectKey.length > 512) {
    throw new InvalidObjectKeyError();
  }
  const segments = objectKey.split("/");
  if (segments.length !== 3) {
    throw new InvalidObjectKeyError();
  }
  for (const segment of segments) {
    if (!OBJECT_KEY_SEGMENT_PATTERN.test(segment)) {
      throw new InvalidObjectKeyError();
    }
  }
}
