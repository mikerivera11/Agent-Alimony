import { describe, expect, it } from "vitest";

import { coerceEditedValue, formatProposedValue } from "../proposalValueFormat";

describe("coerceEditedValue", () => {
  it("keeps a numeric original value numeric when the edited text parses as a number", () => {
    expect(coerceEditedValue(4200, "5000")).toBe(5000);
  });

  it("falls back to the raw string when a numeric original can't be parsed", () => {
    expect(coerceEditedValue(4200, "not-a-number")).toBe("not-a-number");
  });

  it("parses true/false text for boolean originals", () => {
    expect(coerceEditedValue(true, "false")).toBe(false);
    expect(coerceEditedValue(false, "TRUE")).toBe(true);
  });

  it("keeps string originals as strings", () => {
    expect(coerceEditedValue("hello", "goodbye")).toBe("goodbye");
  });
});

describe("formatProposedValue", () => {
  it("renders null as a plain placeholder", () => {
    expect(formatProposedValue(null)).toBe("(none)");
  });

  it("renders numbers and strings as-is", () => {
    expect(formatProposedValue(42)).toBe("42");
    expect(formatProposedValue("text")).toBe("text");
  });

  it("renders a shallow record as key: value pairs", () => {
    expect(formatProposedValue({ a: 1, b: null })).toBe("a: 1, b: (none)");
  });
});
