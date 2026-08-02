import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryIntakeDraftStorage } from "../storage";
import { createSyncedIntakeDraftStorage } from "../syncedStorage";
import type { IntakeDraft } from "../draft";

/**
 * The rule these tests protect: **the network must never be able to lose what
 * someone typed.** A person filling in their own divorce finances may be on a
 * phone in a courthouse hallway; a failed request has to cost version history
 * at worst, never answers.
 */

const draft = { caseBasics: { county: "Orange" } } as unknown as IntakeDraft;

function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return store;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("synced draft storage", () => {
  it("still saves locally when the server is unreachable", async () => {
    installLocalStorage();
    const local = createInMemoryIntakeDraftStorage();
    const statuses: string[] = [];
    const storage = createSyncedIntakeDraftStorage({
      local,
      onStatusChange: (s) => statuses.push(s),
      fetchImpl: () => Promise.reject(new Error("offline")),
    });

    await storage.save(draft);
    await vi.waitFor(() => expect(statuses).toContain("offline"));

    expect(await local.load()).toEqual(draft);
  });

  it("creates the case on first save and updates it afterwards", async () => {
    installLocalStorage();
    const calls: { url: string; method: string }[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (method === "POST") {
        return new Response(JSON.stringify({ id: "case-1", revision: 1 }), { status: 201 });
      }
      return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
    });

    const storage = createSyncedIntakeDraftStorage({
      local: createInMemoryIntakeDraftStorage(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await storage.save(draft);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: "/api/cases", method: "POST" });

    await storage.save(draft);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({ url: "/api/cases/case-1", method: "PUT" });
  });

  it("reports a conflict instead of overwriting a newer version", async () => {
    const store = installLocalStorage();
    store.set(
      "florida-support-guide.case-pointer.v1",
      JSON.stringify({ caseId: "case-1", revision: 3 }),
    );

    const statuses: string[] = [];
    const storage = createSyncedIntakeDraftStorage({
      local: createInMemoryIntakeDraftStorage(),
      onStatusChange: (s) => statuses.push(s),
      fetchImpl: (async () =>
        new Response(JSON.stringify({ revision: 9 }), { status: 409 })) as unknown as typeof fetch,
    });

    await storage.save(draft);
    await vi.waitFor(() => expect(statuses).toContain("conflict"));

    // The newer revision is adopted so the next save can succeed rather than
    // conflicting forever.
    expect(JSON.parse(store.get("florida-support-guide.case-pointer.v1")!)).toEqual({
      caseId: "case-1",
      revision: 9,
    });
  });

  it("does not let an empty server draft wipe local answers", async () => {
    installLocalStorage();
    const local = createInMemoryIntakeDraftStorage();
    await local.save(draft);

    const storage = createSyncedIntakeDraftStorage({
      local,
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/cases") {
          return new Response(JSON.stringify({ cases: [{ id: "case-1", revision: 1 }] }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ draft: {}, revision: 1 }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    expect(await storage.load()).toEqual(draft);
  });

  it("prefers the server draft when it actually has answers", async () => {
    installLocalStorage();
    const local = createInMemoryIntakeDraftStorage();
    const serverDraft = { caseBasics: { county: "Broward" } };

    const storage = createSyncedIntakeDraftStorage({
      local,
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/cases") {
          return new Response(JSON.stringify({ cases: [{ id: "case-1", revision: 4 }] }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ draft: serverDraft, revision: 4 }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    expect(await storage.load()).toEqual(serverDraft);
    expect(await local.load()).toEqual(serverDraft);
  });

  it("falls back to the local draft when the server cannot be reached", async () => {
    installLocalStorage();
    const local = createInMemoryIntakeDraftStorage();
    await local.save(draft);

    const storage = createSyncedIntakeDraftStorage({
      local,
      fetchImpl: (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch,
    });

    expect(await storage.load()).toEqual(draft);
  });

  it("starts a fresh case if the server says the old one is gone", async () => {
    const store = installLocalStorage();
    store.set(
      "florida-support-guide.case-pointer.v1",
      JSON.stringify({ caseId: "case-gone", revision: 2 }),
    );

    const storage = createSyncedIntakeDraftStorage({
      local: createInMemoryIntakeDraftStorage(),
      fetchImpl: (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch,
    });

    await storage.save(draft);
    await vi.waitFor(() =>
      expect(store.get("florida-support-guide.case-pointer.v1")).toBeUndefined(),
    );
  });
});
