import { describe, expect, it } from "vitest";

import {
  alimonyAdvanceSchema,
  alimonyFactorsSchema,
  assetsDebtsSchema,
  caseBasicsSchema,
  childrenSchema,
  documentReadinessSchema,
  DEFAULT_HOLIDAY_SCHEDULES,
  filingDetailsSchema,
  marriageSchema,
  parentingPlanSchema,
  parentingTimeSchema,
  safetyComplexitySchema,
} from "../schema";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

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

describe("filingDetailsSchema", () => {
  it("requires a structured child residence history covering at least five years", () => {
    const filing = createSampleDraft().data.filingDetails;
    if (!filing.children?.[0]?.residences?.[0]) throw new Error("Expected sample residence.");
    filing.children[0].residences[0].fromDate = "2025-01-01";

    const result = filingDetailsSchema.safeParse(filing);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Add earlier residences until the history covers at least five years",
      );
    }
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

describe("parentingPlanSchema", () => {
  const completePlan = {
    planStatus: "proposed" as const,
    schoolDesignationParent: "undecided" as const,
    decisionMakingEducation: "undecided" as const,
    decisionMakingHealthcare: "undecided" as const,
    decisionMakingReligion: "undecided" as const,
    weekdaySchedule: "",
    weekendSchedule: "",
    holidaySchedule: "",
    holidayScheduleMode: "specific" as const,
    holidayScheduleOverridesRegular: true,
    holidaySchedules: DEFAULT_HOLIDAY_SCHEDULES.map((holiday) => ({ ...holiday })),
    threeWeekendAdjustment: false,
    unspecifiedHolidayFollowsAdjacentWeekend: false,
    summerSchedule: "",
    exchangeArrangements: "",
    communicationBetweenChildAndParent: "",
    relocationAnticipated: "no" as const,
  };

  it("starts the requested major holidays as alternating-year proposals", () => {
    expect(completePlan.holidaySchedules.map((holiday) => holiday.name)).toEqual([
      "Thanksgiving",
      "Christmas",
      "New Year's Day",
    ]);
    expect(completePlan.holidaySchedules.every((holiday) => holiday.rotation === "alternating")).toBe(true);
    expect(parentingPlanSchema.safeParse(completePlan).success).toBe(true);
  });

  describe("alimonyAdvanceSchema", () => {
    const advance = createSampleDraft().data.alimonyAdvance;

    it("accepts an installment schedule that equals the total advance", () => {
      expect(alimonyAdvanceSchema.safeParse(advance).success).toBe(true);
    });

    it("rejects an installment schedule that does not equal the total advance", () => {
      const result = alimonyAdvanceSchema.safeParse({
        ...advance,
        paymentSchedule: advance.paymentSchedule?.map((payment, index) =>
          index === 0 ? { ...payment, amount: 4000 } : payment,
        ),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join(".") === "paymentSchedule")).toBe(true);
      }
    });

    it("keeps the questionnaire optional", () => {
      expect(
        alimonyAdvanceSchema.safeParse({
          wantsAdvanceAgreement: "no",
          advanceAmount: 0,
          finalSettlementAmount: 0,
        }).success,
      ).toBe(true);
    });
  });

  it("puts Christmas opposite Thanksgiving so one parent does not receive both in one year", () => {
    const thanksgiving = completePlan.holidaySchedules.find((holiday) => holiday.name === "Thanksgiving");
    const christmas = completePlan.holidaySchedules.find((holiday) => holiday.name === "Christmas");
    expect(thanksgiving?.oddYearParent).not.toBe(christmas?.oddYearParent);
  });

  it("refuses an alternating holiday without an odd-year parent", () => {
    const invalid = {
      ...completePlan,
      holidaySchedules: [
        {
          id: "custom",
          name: "Child's birthday",
          rotation: "alternating" as const,
          beginEndTime: "",
          notes: "",
        },
      ],
    };
    const result = parentingPlanSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "holidaySchedules.0.oddYearParent")).toBe(
        true,
      );
    }
  });

  it("accepts a legacy narrative plan without structured holiday fields", () => {
    const legacyPlan = { ...completePlan } as Record<string, unknown>;
    delete legacyPlan.holidayScheduleMode;
    delete legacyPlan.holidayScheduleOverridesRegular;
    delete legacyPlan.holidaySchedules;
    delete legacyPlan.threeWeekendAdjustment;
    delete legacyPlan.unspecifiedHolidayFollowsAdjacentWeekend;

    expect(
      parentingPlanSchema.safeParse({
        ...legacyPlan,
        holidaySchedule: "The parents alternate holidays under their existing written schedule.",
      }).success,
    ).toBe(true);
  });

  it("ignores retained incomplete rows when the specific schedule is hidden", () => {
    const result = parentingPlanSchema.safeParse({
      ...completePlan,
      holidayScheduleMode: "regular_schedule",
      holidaySchedules: [
        {
          id: "retained-custom",
          name: "",
          rotation: "alternating",
          beginEndTime: "",
          notes: "",
        },
      ],
    });

    expect(result.success).toBe(true);
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

  it("defaults older asset rows to no agreed settlement assignment", () => {
    const source = createSampleDraft().data.assetsDebts;
    const items = source.items;
    expect(items).toBeDefined();
    if (!items) throw new Error("Sample draft must include asset and debt items");
    const legacyItem = { ...items[0] } as Record<string, unknown>;
    delete legacyItem.agreedRecipient;

    const result = assetsDebtsSchema.parse({
      ...source,
      items: [legacyItem],
    });

    expect(result.items[0]?.agreedRecipient).toBe("not_agreed");
  });

  it("does not allow a debt to use the sell-and-divide asset disposition", () => {
    const source = createSampleDraft().data.assetsDebts;
    const items = source.items;
    expect(items).toBeDefined();
    if (!items) throw new Error("Sample draft must include asset and debt items");
    const result = assetsDebtsSchema.safeParse({
      ...source,
      items: [
        {
          ...items.find((item) => item.type === "liability"),
          agreedRecipient: "sell_and_divide",
        },
      ],
    });

    expect(result.success).toBe(false);
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

  it("requires complete payment terms when the parties report an agreement", () => {
    const factors = createSampleDraft().data.alimonyFactors;
    factors.agreedAlimonyAmount = 0;
    factors.agreedAlimonyEndCondition = "";

    const result = alimonyFactorsSchema.safeParse(factors);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("Enter the agreed payment amount");
      expect(messages).toContain("Enter the agreed duration or ending condition");
    }
  });

  it("does not require payment fields for an agreed no-alimony disposition", () => {
    const factors = {
      ...createSampleDraft().data.alimonyFactors,
      alimonyAgreementStatus: "agreed_waiver",
      agreedAlimonyAmount: 0,
      agreedAlimonyType: undefined,
      agreedAlimonyFrequency: undefined,
      agreedAlimonyStartDate: undefined,
      agreedAlimonyEndCondition: "",
      agreedAlimonyModifiability: undefined,
      agreedAlimonyPaymentMethod: undefined,
      agreedAlimonySecurity: undefined,
    };

    expect(alimonyFactorsSchema.safeParse(factors).success).toBe(true);
  });

  it("keeps drafts saved before agreed-term fields were added valid", () => {
    const factors = { ...createSampleDraft().data.alimonyFactors } as Record<string, unknown>;
    delete factors.alimonyAgreementStatus;
    delete factors.agreedAlimonyAmount;

    const result = alimonyFactorsSchema.safeParse(factors);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alimonyAgreementStatus).toBe("not_agreed");
      expect(result.data.agreedAlimonyAmount).toBe(0);
    }
  });
});
