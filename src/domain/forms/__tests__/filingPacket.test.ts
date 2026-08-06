/**
 * These tests guard three things the filing packet exists to get right:
 *
 * 1. No form is presented as authoritative unless its number, title, and
 *    revision were actually read from the court's own PDF. A wrong revision
 *    is not cosmetic — it means someone files a superseded document.
 * 2. The packet reports what is *missing* honestly. A packet that silently
 *    omits a gap is worse than no packet, because it looks complete.
 * 3. The residency check is arithmetic, not self-assessment, and it is
 *    checked at the boundary where it flips.
 */

import { describe, expect, it } from "vitest";

import {
  buildFilingReadiness,
  buildSettlementTermSheet,
  FLORIDA_RESIDENCY_MONTHS_REQUIRED,
  OFFICIAL_FILING_FORMS,
  PARENTING_PLAN_FORM,
  wholeMonthsBetween,
} from "@/domain/forms";
import { buildReviewedDraft, type IntakeDraftData } from "@/domain/intake";
import { buildPackageViewModel } from "@/domain/package";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

const AS_OF = "2026-08-02";

function draftData(): IntakeDraftData {
  return createSampleDraft().data;
}

describe("official form catalogue", () => {
  it("never presents a form as verified without a revision and a URL", () => {
    for (const entry of OFFICIAL_FILING_FORMS) {
      if (!entry.form.verified) continue;
      expect(entry.form.revision, `${entry.form.formNumber} revision`).toMatch(/^\d{2}\/\d{2}$/);
      expect(entry.form.url, `${entry.form.formNumber} url`).toMatch(/^https:\/\/www\.flcourts\.gov\//);
      expect(entry.form.title.length).toBeGreaterThan(0);
    }
  });

  it("lists each form number exactly once", () => {
    const numbers = OFFICIAL_FILING_FORMS.map((entry) => entry.form.formNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("keeps the parenting plan at the revision printed in the court's PDF", () => {
    // Regression guard: this was recorded as 03/09 for a while, which was a
    // misreading. The document's only revision token is 02/18.
    expect(PARENTING_PLAN_FORM.revision).toBe("02/18");
  });

  it("does not offer the simplified settlement agreement as the one for children", () => {
    const withChildren = OFFICIAL_FILING_FORMS.find((e) => e.form.formNumber === "12.902(f)(1)");
    const simplified = OFFICIAL_FILING_FORMS.find((e) => e.form.formNumber === "12.902(f)(3)");
    expect(withChildren?.form.title).toMatch(/Dependent or Minor Child/i);
    expect(simplified?.form.title).toMatch(/Simplified/i);
  });
});

describe("wholeMonthsBetween", () => {
  it("counts only complete months", () => {
    expect(wholeMonthsBetween("2026-01-15", "2026-07-14")).toBe(5);
    expect(wholeMonthsBetween("2026-01-15", "2026-07-15")).toBe(6);
    expect(wholeMonthsBetween("2026-01-15", "2026-07-16")).toBe(6);
  });

  it("handles a month-end start date without overcounting", () => {
    expect(wholeMonthsBetween("2026-01-31", "2026-02-28")).toBe(0);
  });
});

describe("buildFilingReadiness", () => {
  it("collects nothing and reports nothing when the packet was not requested", () => {
    const data = draftData();
    data.filingDetails = { wantsFilingPacket: "no" };

    const readiness = buildFilingReadiness({ data, asOfIso: AS_OF });

    expect(readiness.requested).toBe(false);
    expect(readiness.forms).toHaveLength(0);
  });

  it("selects the child-related forms when the case involves children", () => {
    const readiness = buildFilingReadiness({ data: draftData(), asOfIso: AS_OF });
    const numbers = readiness.forms.map((form) => form.entry.form.formNumber);

    expect(numbers).toContain("12.901(b)(1)");
    expect(numbers).toContain("12.902(d)");
    expect(numbers).toContain("12.995(a)");
    expect(numbers).toContain("12.902(e)");
    expect(numbers).not.toContain("12.901(b)(3)");
  });

  it("selects the childless petition when there are no children", () => {
    const data = draftData();
    data.children = { hasChildren: "no", children: [] };

    const numbers = buildFilingReadiness({ data, asOfIso: AS_OF }).forms.map(
      (form) => form.entry.form.formNumber,
    );

    expect(numbers).toContain("12.901(b)(2)");
    expect(numbers).not.toContain("12.901(b)(1)");
    expect(numbers).not.toContain("12.995(a)");
    expect(numbers).not.toContain("12.902(d)");
  });

  it("names the specific answer that is missing rather than saying 'incomplete'", () => {
    const data = draftData();
    data.filingDetails = { ...data.filingDetails, spouse: { address: {}, dateOfBirth: undefined } };

    const petition = buildFilingReadiness({ data, asOfIso: AS_OF }).forms.find(
      (form) => form.entry.form.formNumber === "12.901(b)(1)",
    );

    expect(petition?.status).toBe("needsInformation");
    expect(petition?.missing).toContain("Your spouse's full legal name");
  });

  it("flags every child missing a five-year address history", () => {
    const data = draftData();
    data.filingDetails = {
      ...data.filingDetails,
      children: [{ childId: "demo-child-1", fullLegalName: "A Child", addressHistory: "" }],
    };

    const uccjea = buildFilingReadiness({ data, asOfIso: AS_OF }).forms.find(
      (form) => form.entry.form.formNumber === "12.902(d)",
    );

    expect(uccjea?.missing).toContain("Each child's five-year address history");
    expect(uccjea?.missing).toContain("Filing details for every child");
  });

  it("names holiday timing gaps on the parenting-plan form", () => {
    const data = draftData();
    data.parentingPlan = {
      ...data.parentingPlan,
      holidaySchedules: data.parentingPlan.holidaySchedules?.map((holiday) =>
        holiday.name === "Christmas" ? { ...holiday, beginEndTime: "" } : holiday,
      ),
    };

    const parentingPlan = buildFilingReadiness({ data, asOfIso: AS_OF }).forms.find(
      (form) => form.entry.form.formNumber === "12.995(a)",
    );

    expect(parentingPlan?.missing).toContain("Beginning and ending time for Christmas");
  });

  it("says the Social Security notice must be completed by hand", () => {
    const ssn = buildFilingReadiness({ data: draftData(), asOfIso: AS_OF }).forms.find(
      (form) => form.entry.form.formNumber === "12.902(j)",
    );

    expect(ssn?.status).toBe("completeByHand");
    expect(ssn?.missing.join(" ")).toMatch(/never collects/i);
  });

  describe("residency", () => {
    it("is satisfied at exactly six months, and not a day before", () => {
      const data = draftData();
      data.filingDetails = {
        ...data.filingDetails,
        whichPartyIsFloridaResident: "you",
        floridaResidentSince: "2026-02-02",
      };
      const exactly = buildFilingReadiness({ data, asOfIso: "2026-08-02" }).residency;
      const oneDayShort = buildFilingReadiness({ data, asOfIso: "2026-08-01" }).residency;

      expect(exactly.kind).toBe("checked");
      expect(exactly.kind === "checked" && exactly.monthsResident).toBe(FLORIDA_RESIDENCY_MONTHS_REQUIRED);
      expect(exactly.kind === "checked" && exactly.satisfied).toBe(true);
      expect(oneDayShort.kind === "checked" && oneDayShort.satisfied).toBe(false);
    });

    it("does not guess when the date is absent", () => {
      const data = draftData();
      data.filingDetails = { ...data.filingDetails, floridaResidentSince: undefined };
      expect(buildFilingReadiness({ data, asOfIso: AS_OF }).residency.kind).toBe("notProvided");
    });

    it("warns plainly when neither spouse lives in Florida", () => {
      const data = draftData();
      data.filingDetails = { ...data.filingDetails, whichPartyIsFloridaResident: "neither" };
      const residency = buildFilingReadiness({ data, asOfIso: AS_OF }).residency;

      expect(residency.kind).toBe("noResidentParty");
      expect(residency.message).toMatch(/may not be able to hear this case/i);
    });
  });

  it("surfaces a safety concern as a general gap, not buried in a form", () => {
    const data = draftData();
    data.safetyComplexity = { ...data.safetyComplexity, domesticViolenceOrCoercion: "yes" };

    const gaps = buildFilingReadiness({ data, asOfIso: AS_OF }).generalGaps.join(" ");
    expect(gaps).toMatch(/safety concerns/i);
  });
});

describe("buildSettlementTermSheet", () => {
  function termSheet(data: IntakeDraftData = draftData()) {
    const draft = createSampleDraft();
    draft.data = data;
    const viewModel = buildPackageViewModel(buildReviewedDraft(draft));
    return buildSettlementTermSheet({
      data,
      packageViewModel: viewModel,
      generatedAt: "2026-08-02T00:00:00.000Z",
    });
  }

  it("covers alimony, child support, property, and parenting", () => {
    const ids = termSheet().sections.map((section) => section.id);
    expect(ids).toEqual(["alimony", "childSupport", "equitableDistribution", "parenting"]);
  });

  it("gives every figure a stated basis, so nothing is unsourced", () => {
    for (const section of termSheet().sections) {
      for (const item of section.items) {
        expect(item.basis.length, `${section.id} / ${item.label}`).toBeGreaterThan(0);
      }
    }
  });

  it("states it is not a settlement agreement", () => {
    const sheet = termSheet();
    expect(sheet.disclaimer).toMatch(/not a marital settlement agreement/i);
    expect(sheet.disclaimer).toMatch(/binds nobody/i);
  });

  it("leaves the legal judgements to an attorney rather than deciding them", () => {
    const sheet = termSheet();
    const alimony = sheet.sections.find((section) => section.id === "alimony");
    const property = sheet.sections.find((section) => section.id === "equitableDistribution");

    expect(alimony?.attorneyDecisions.join(" ")).toMatch(/modifiable/i);
    expect(property?.attorneyDecisions.join(" ")).toMatch(/Qualified Domestic Relations Order/i);
  });

  it("says why a section is unavailable instead of showing an empty one", () => {
    const data = draftData();
    data.children = { hasChildren: "no", children: [] };

    const childSupport = termSheet(data).sections.find((section) => section.id === "childSupport");
    expect(childSupport?.items).toHaveLength(0);
    expect(childSupport?.unavailable).toMatch(/No children/i);
  });

  it("presents alimony as a range, never as a single predicted figure", () => {
    const alimony = termSheet().sections.find((section) => section.id === "alimony");
    const amount = alimony?.items.find((item) => item.label === "Estimated monthly amount");
    expect(amount?.value).toMatch(/ to /);
  });
});
