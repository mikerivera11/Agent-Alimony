import { describe, expect, it } from "vitest";

import { InvalidObjectKeyError } from "./adapter";
import { assertValidObjectKey, generateObjectKey } from "./object-key";

describe("object-key", () => {
  it("generates keys with exactly three random, traversal-free segments", () => {
    const key = generateObjectKey();
    expect(key.split("/")).toHaveLength(3);
    expect(() => assertValidObjectKey(key)).not.toThrow();
  });

  it("generated keys are unique across many calls", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateObjectKey()));
    expect(keys.size).toBe(200);
  });

  it.each([
    ["../escape/attempt", "parent traversal"],
    ["a/../../b", "embedded traversal"],
    ["/etc/passwd", "absolute path"],
    ["a/b", "too few segments"],
    ["a/b/c/d", "too many segments"],
    ["a/b/c.txt", "disallowed character (dot)"],
    ["a/b/c d", "disallowed character (space)"],
    ["", "empty string"],
    ["a/b/c\u0000", "embedded null byte"],
  ])("rejects %j (%s)", (candidate) => {
    expect(() => assertValidObjectKey(candidate)).toThrow(InvalidObjectKeyError);
  });
});
