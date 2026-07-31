import { describe, expect, it } from "vitest";

import {
  alimonyFactorsSchema,
  assetsDebtsSchema,
  caseBasicsSchema,
  childrenSchema,
  documentReadinessSchema,
  marriageSchema,
  parentingTimeSchema,
  safetyComplexitySchema,
} from "../schema";

describe("caseBasicsSchema", () => {
  it("requires a filing or planning date for both filed and not-filed cases", () => {
    const notFiled = caseBasicsSchema.safeParse({
      county: "Orange",
      caseType: "without_children",
      petitionStatus: "not_filed",
      hasAttorney: "no",
    });
    expect(notFiled.success).toBe(false);

    const filedWithoutDate = caseBasicsSchema.safeParse({
      county: "Orange",
      caseType: "without_children",
      petitionStatus: "filed",
      hasAttorney: "no",
    });
    expect(filedWithoutDate.success).toBe(false);
    if (!filedWithoutDate.success) {
      expect(filedWithoutDate.error.issues.some((issue) => issue.path.join(".") === "petitionDate")).toBe(true);
    }

    const filedWithDate = caseBasicsSchema.safeParse({
      county: "Orange",
      caseType: "without_children",
      petitionStatus: "filed",
      petitionDate: "2025-01-15",
      hasAttorney: "no",
    });
    expect(filedWithDate.success).toBe(true);

    const notFiledWithPlanningDate = caseBasicsSchema.safeParse({
      county: "Orange",
      caseType: "without_children",
      petitionStatus: "not_filed",
      petitionDate: "2025-01-15",
      hasAttorney: "no",
    });
    expect(notFiledWithPlanningDate.success).toBe(true);
  });
});

describe("marriageSchema", () => {
  it("requires a separation date only when separated with a known date", () => {
    const stillTogether = marriageSchema.safeParse({
      marriageDate: "2015-05-01",
      separationStatus: "living_together",
    });
    expect(stillTogether.success).toBe(true);

    const missingSeparationDate = marriageSchema.safeParse({
      marriageDate: "2015-05-01",
      separationStatus: "separated_with_date",
    });
    expect(missingSeparationDate.success).toBe(false);
  });

  it("rejects a separation date before the marriage date", () => {
    const result = marriageSchema.safeParse({
      marriageDate: "2020-01-01",
      separationStatus: "separated_with_date",
      separationDate: "2019-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a marriage date in the future", () => {
    const result = marriageSchema.safeParse({
      marriageDate: "2999-01-01",
      separationStatus: "living_together",
    });
    expect(result.success).toBe(false);
  });
});

describe("childrenSchema", () => {
  it("requires at least one child when hasChildren is yes", () => {
    const result = childrenSchema.safeParse({ hasChildren: "yes", children: [] });
    expect(result.success).toBe(false);
  });

  it("allows an empty children list when hasChildren is no", () => {
    const result = childrenSchema.safeParse({ hasChildren: "no", children: [] });
    expect(result.success).toBe(true);
  });

  it("requires special-needs details only when hasSpecialNeeds is yes", () => {
    const result = childrenSchema.safeParse({
      hasChildren: "yes",
      children: [
        {
          id: "1",
          nameOrInitials: "A.B.",
          dateOfBirth: "2015-01-01",
          hasSpecialNeeds: "yes",
          specialNeedsDetails: "",
        },
      ],
    });
    expect(result.success).toBe(false);

    const withDetails = childrenSchema.safeParse({
      hasChildren: "yes",
      children: [
        {
          id: "1",
          nameOrInitials: "A.B.",
          dateOfBirth: "2015-01-01",
          hasSpecialNeeds: "yes",
          specialNeedsDetails: "Needs occupational therapy weekly.",
        },
      ],
    });
    expect(withDetails.success).toBe(true);
  });
});

describe("parentingTimeSchema", () => {
  it("rejects overnight totals over 366", () => {
    const result = parentingTimeSchema.safeParse({
      overnightsWithYouPerYear: 300,
      overnightsWithOtherParentPerYear: 300,
      scheduleStatus: "agreed",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid overnight split", () => {
    const result = parentingTimeSchema.safeParse({
      overnightsWithYouPerYear: 200,
      overnightsWithOtherParentPerYear: 165,
      scheduleStatus: "agreed",
    });
    expect(result.success).toBe(true);
  });

  it("treats a blank number field as zero", () => {
    const result = parentingTimeSchema.safeParse({
      overnightsWithYouPerYear: "",
      overnightsWithOtherParentPerYear: 100,
      scheduleStatus: "not_yet_discussed",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overnightsWithYouPerYear).toBe(0);
    }
  });
});

describe("assetsDebtsSchema", () => {
  it("requires details when other support obligations are reported", () => {
    const result = assetsDebtsSchema.safeParse({
      maritalAssetsEstimatedValue: 0,
      maritalDebtsEstimatedValue: 0,
      hasOtherSupportObligations: "yes",
      hasHiddenOrUnknownAssets: "no",
      hasComplexBusinessInterests: "no",
    });
    expect(result.success).toBe(false);
  });

  it("passes when no other support obligations are reported", () => {
    const result = assetsDebtsSchema.safeParse({
      maritalAssetsEstimatedValue: 100000,
      maritalDebtsEstimatedValue: 5000,
      hasOtherSupportObligations: "no",
      hasHiddenOrUnknownAssets: "no",
      hasComplexBusinessInterests: "no",
    });
    expect(result.success).toBe(true);
  });
});

describe("safetyComplexitySchema", () => {
  it("requires the safety follow-up only when domestic violence or coercion is reported", () => {
    const missingFollowUp = safetyComplexitySchema.safeParse({
      domesticViolenceOrCoercion: "yes",
      hasJurisdictionDispute: "no",
      incomeIsImputedOrDisputed: "no",
      filedOrFilingBeforeJuly2023: "no",
    });
    expect(missingFollowUp.success).toBe(false);

    const withFollowUp = safetyComplexitySchema.safeParse({
      domesticViolenceOrCoercion: "yes",
      feelsSafeToContinueOnline: "no",
      hasJurisdictionDispute: "no",
      incomeIsImputedOrDisputed: "no",
      filedOrFilingBeforeJuly2023: "no",
    });
    expect(withFollowUp.success).toBe(true);

    const noConcern = safetyComplexitySchema.safeParse({
      domesticViolenceOrCoercion: "no",
      hasJurisdictionDispute: "no",
      incomeIsImputedOrDisputed: "no",
      filedOrFilingBeforeJuly2023: "no",
    });
    expect(noConcern.success).toBe(true);
  });
});

describe("documentReadinessSchema", () => {
  it("requires the seven-day retention acknowledgement to be explicitly true", () => {
    const notAcknowledged = documentReadinessSchema.safeParse({
      hasRecentPayStubsOrIncomeProof: "no",
      hasTaxReturnsLastThreeYears: "no",
      hasBankAndAssetStatements: "no",
      hasParentingOrTimeshareRecords: "not_applicable",
      acknowledgesSevenDayRetention: false,
    });
    expect(notAcknowledged.success).toBe(false);

    const acknowledged = documentReadinessSchema.safeParse({
      hasRecentPayStubsOrIncomeProof: "no",
      hasTaxReturnsLastThreeYears: "no",
      hasBankAndAssetStatements: "no",
      hasParentingOrTimeshareRecords: "not_applicable",
      acknowledgesSevenDayRetention: true,
    });
    expect(acknowledged.success).toBe(true);
  });
});

describe("alimonyFactorsSchema", () => {
  it("requires the section 61.08 narrative factors to be filled in", () => {
    const result = alimonyFactorsSchema.safeParse({
      standardOfLivingDuringMarriage: "",
      ageAndHealthSelf: "",
      ageAndHealthSpouse: "",
      earningCapacitySelf: "",
      earningCapacitySpouse: "",
      contributionsToMarriage: "",
      requestedAlimonyType: "not_sure",
    });
    expect(result.success).toBe(false);
  });
});
