/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_INTAKE_MODE,
  getIntakeModeServerSnapshot,
  getIntakeModeSnapshot,
  isIntakeMode,
  loadIntakeMode,
  resetIntakeModeCache,
  saveIntakeMode,
  setIntakeMode,
  subscribeIntakeMode,
} from "../mode";

describe("intake mode preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetIntakeModeCache();
  });

  it("defaults to the guided flow", () => {
    expect(DEFAULT_INTAKE_MODE).toBe("guided");
    expect(loadIntakeMode()).toBe("guided");
  });

  it("round-trips a saved choice", () => {
    saveIntakeMode("allAtOnce");
    expect(loadIntakeMode()).toBe("allAtOnce");
  });

  it("falls back to the default for an unrecognised stored value", () => {
    window.localStorage.setItem("florida-support-guide.intake-mode.v1", "something-else");
    expect(loadIntakeMode()).toBe("guided");
  });

  it("recognises only the two supported modes", () => {
    expect(isIntakeMode("guided")).toBe(true);
    expect(isIntakeMode("allAtOnce")).toBe(true);
    expect(isIntakeMode("wizard")).toBe(false);
    expect(isIntakeMode(undefined)).toBe(false);
  });

  it("returns a stable snapshot so React does not re-render endlessly", () => {
    expect(getIntakeModeSnapshot()).toBe(getIntakeModeSnapshot());
  });

  it("always renders the default on the server, which cannot read the preference", () => {
    saveIntakeMode("allAtOnce");
    expect(getIntakeModeServerSnapshot()).toBe("guided");
  });

  it("notifies subscribers when the mode changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeIntakeMode(listener);

    setIntakeMode("allAtOnce");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getIntakeModeSnapshot()).toBe("allAtOnce");
    expect(loadIntakeMode()).toBe("allAtOnce");

    unsubscribe();
    setIntakeMode("guided");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps working when localStorage throws, as in private browsing", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    // The preference is a convenience, never a blocker: a browser that refuses
    // storage should still render the intake rather than throw.
    expect(() => saveIntakeMode("allAtOnce")).not.toThrow();
    expect(loadIntakeMode()).toBe("guided");

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
