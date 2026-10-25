// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickExitLink } from "../QuickExitLink";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("QuickExitLink", () => {
  it("clears app data and starts a keepalive sign-out before leaving", () => {
    window.localStorage.setItem("florida-support-guide.intake-draft.v1", "sensitive");
    window.localStorage.setItem("unrelated.preference", "keep");
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(<QuickExitLink />);
    const link = screen.getByRole("link", { name: /quick exit/i });
    expect(link.getAttribute("href")).toBe("https://www.weather.gov");
    fireEvent.click(link);

    expect(window.localStorage.getItem("florida-support-guide.intake-draft.v1")).toBeNull();
    expect(window.localStorage.getItem("unrelated.preference")).toBe("keep");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signout", {
      method: "POST",
      keepalive: true,
      headers: { accept: "application/json" },
    });
  });
});
