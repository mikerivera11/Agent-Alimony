import { afterEach, describe, expect, it, vi } from "vitest";

import { clearLocalCaseData } from "../localData";

afterEach(() => {
  vi.unstubAllGlobals();
});

function installLocalStorage(entries: Record<string, string>) {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal("window", {
    localStorage: {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return store;
}

describe("clearLocalCaseData", () => {
  it("removes every key the app owns, not a hand-maintained list", () => {
    const store = installLocalStorage({
      "florida-support-guide.intake-draft.v1": "{}",
      "florida-support-guide.case-pointer.v1": "{}",
      "florida-support-guide.reviewed.v1": "{}",
      "florida-support-guide.documents.proposal-decisions.v1": "{}",
      // A key nobody has written yet. The sweep must cover it too, because a
      // list would go stale the first time someone adds one — and the cost of
      // that is disclosing a stranger's finances.
      "florida-support-guide.some-future-key.v1": "{}",
      "unrelated-app-key": "keep me",
    });

    clearLocalCaseData();

    expect([...store.keys()]).toEqual(["unrelated-app-key"]);
  });

  it("removes all matching keys even though removal shifts indices", () => {
    const store = installLocalStorage(
      Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`florida-support-guide.k${i}`, "x"]),
      ),
    );

    clearLocalCaseData();

    expect(store.size).toBe(0);
  });

  it("does nothing and does not throw when storage is unavailable", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("blocked in private browsing");
      },
    });
    expect(() => clearLocalCaseData()).not.toThrow();
  });

  it("does nothing on the server, where there is no browser store", () => {
    vi.stubGlobal("window", undefined);
    expect(() => clearLocalCaseData()).not.toThrow();
  });
});
