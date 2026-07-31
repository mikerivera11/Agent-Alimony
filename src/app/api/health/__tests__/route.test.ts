import { describe, expect, it } from "vitest";

import packageJson from "../../../../../package.json";
import { GET } from "../route";

describe("GET /api/health", () => {
  it("returns a minimal ok status with the app version and no-store headers", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body).toEqual({ status: "ok", version: packageJson.version });
  });

  it("never includes environment/secret-shaped keys in the payload", async () => {
    const body = await GET().json();
    const keys = Object.keys(body);
    expect(keys.sort()).toEqual(["status", "version"]);
    for (const key of keys) {
      expect(key.toUpperCase()).not.toContain("SECRET");
      expect(key.toUpperCase()).not.toContain("DATABASE");
      expect(key.toUpperCase()).not.toContain("KEY");
    }
  });
});
