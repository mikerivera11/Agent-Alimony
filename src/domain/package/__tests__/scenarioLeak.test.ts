import { describe, expect, it, vi } from "vitest";

import { confirmFact } from "@/domain/rules";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { buildReviewedDraft } from "@/domain/intake";

/**
 * The what-if feature deliberately lets a hypothetical number through the
 * rules engine. That makes "a hypothetical must never reach a document" a
 * real risk rather than a theoretical one, so it is enforced and tested
 * rather than left to convention.
 */

vi.mock("@/domain/integration", async () => {
  const actual = await vi.importActual<typeof import("@/domain/integration")>("@/domain/integration");
  return {
    ...actual,
    mapReviewedDraftToChildSupportInput: (reviewed: Parameters<typeof actual.mapReviewedDraftToChildSupportInput>[0]) => {
      const real = actual.mapReviewedDraftToChildSupportInput(reviewed);
      if (real.kind !== "mapped") return real;
      // Exactly the mistake being guarded against: a mapper that stamps a
      // hypothetical provenance onto an otherwise valid input.
      return { ...real, value: confirmFact(real.value.value, "conversational-scenario") };
    },
  };
});

describe("package export refuses hypothetical figures", () => {
  it("throws rather than printing a what-if in a package", async () => {
    const { buildPackageViewModel } = await import("../buildPackageViewModel");
    const reviewed = buildReviewedDraft(createSampleDraft());

    expect(() => buildPackageViewModel(reviewed)).toThrow(/hypothetical what-if/i);
  });
});
