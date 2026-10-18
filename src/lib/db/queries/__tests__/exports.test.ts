import { describe, it, expect } from "vitest";
import { mapExportRow, type ExportRowSource } from "../exports";

/**
 * CALC-12 — export row-mapping tests.
 *
 * `mapExportRow` is the pure function `getExportRows` maps each application
 * row through. Tested directly (no DB) against a v1 fixture (legacy columns
 * only) and a v2 fixture (min-of-three / gap-tracking columns populated) to
 * confirm the new v2 columns surface correctly and stay blank for v1 rows.
 */

function baseSource(): ExportRowSource {
  return {
    reference: "JWF-0001",
    childName: "Jamie Smith",
    school: "TRINITY",
    assessment: {
      outcome: "QUALIFIES",
      synopsis: "A synopsis.",
      debtStatusLabel: null,
      lifestyleSqueezeLabel: null,
      totalHouseholdNetIncome: 50000,
      manualAdjustment: 0,
      manualAdjustmentReason: null,
      vatRate: 20,
      recommendation: {
        familySynopsis: "A family synopsis.",
        accommodationStatus: "Renting",
        incomeCategory: "3",
        propertyCategory: 1,
        bursaryAward: 12000,
        yearlyPayableFees: 8000,
        monthlyPayableFees: 666.67,
        dishonestyFlag: false,
        creditRiskFlag: false,
        recommendedPayableFees: null,
        confirmedPayableFees: null,
        gapAmount: null,
        scholarshipSpendBeforeVat: null,
        reasonCodes: [{ reasonCode: { code: 1, label: "Redundancy" } }],
        gapReasons: [],
      },
    },
  };
}

describe("mapExportRow", () => {
  it("maps a v1 row — legacy columns populated, v2 columns blank/null", () => {
    const row = mapExportRow(baseSource());

    expect(row.reference).toBe("JWF-0001");
    expect(row.childFirstName).toBe("Jamie");
    expect(row.childLastName).toBe("Smith");
    expect(row.incomeCategory).toBe("3");
    expect(row.propertyCategory).toBe("1");
    expect(row.bursaryAward).toBe(12000);
    expect(row.yearlyPayableFees).toBe(8000);
    expect(row.monthlyPayableFees).toBe(666.67);
    expect(row.reasonCodes).toBe("1 – Redundancy");
    expect(row.outcome).toBe("Qualifies");

    // CALC-12 v2 columns: blank/null for a v1 row.
    expect(row.recommendedPayableFees).toBeNull();
    expect(row.confirmedPayableFees).toBeNull();
    expect(row.gapAmount).toBeNull();
    expect(row.gapReasons).toBe("");
    expect(row.mainGapReason).toBe("");
    expect(row.scholarshipAdjustedGap).toBeNull();
    expect(row.debtStatus).toBe("");
    expect(row.lifestyleSqueezeLabel).toBe("");

    // Epic 13 / C2 — a zero adjustment exports as 0 with a blank reason.
    expect(row.totalHouseholdNetIncome).toBe(50000);
    expect(row.manualAdjustment).toBe(0);
    expect(row.manualAdjustmentReason).toBe("");
  });

  it("maps a v2 row — min-of-three, gap tracking, and profiling columns populated", () => {
    const source: ExportRowSource = {
      reference: "JWF-0002",
      childName: "Alex Jones",
      school: "WHITGIFT",
      assessment: {
        outcome: "QUALIFIES",
        synopsis: "v2 synopsis (Recommendation.familySynopsis is null for v2).",
        debtStatusLabel: "Manageable",
        lifestyleSqueezeLabel: "Squeezed",
        totalHouseholdNetIncome: 72500,
        manualAdjustment: 12500,
        manualAdjustmentReason: "Second parent's income added (separated household)",
        vatRate: 20,
        recommendation: {
          familySynopsis: null,
          accommodationStatus: null,
          incomeCategory: "5",
          propertyCategory: 7,
          bursaryAward: 15000,
          yearlyPayableFees: 15676,
          monthlyPayableFees: 1306.33,
          dishonestyFlag: false,
          creditRiskFlag: false,
          recommendedPayableFees: 12000,
          confirmedPayableFees: 15676,
          gapAmount: -3676,
          scholarshipSpendBeforeVat: 2000,
          reasonCodes: [],
          // Display order (sortOrder) puts 104 first; rank puts 110 first.
          gapReasons: [
            { gapReason: { code: 104, label: "Committee discretion", rank: 8, sortOrder: 4 } },
            { gapReason: { code: 110, label: "Affordability view", rank: 4, sortOrder: 13 } },
          ],
        },
      },
    };

    const row = mapExportRow(source);

    // Falls back to Assessment.synopsis since v2 leaves familySynopsis null.
    expect(row.familySynopsis).toBe(
      "v2 synopsis (Recommendation.familySynopsis is null for v2)."
    );
    expect(row.incomeCategory).toBe("5");
    expect(row.propertyCategory).toBe("7");
    expect(row.recommendedPayableFees).toBe(12000);
    expect(row.confirmedPayableFees).toBe(15676);
    expect(row.gapAmount).toBe(-3676);
    expect(row.gapReasons).toBe(
      "104 – Committee discretion, 110 – Affordability view"
    );
    // Epic 21 #2 — the highest-ranked code, not the first listed.
    expect(row.mainGapReason).toBe("110 – Affordability view");
    // Epic 21 #1 — −3,676 + 2,000 × 1.2 = −1,276.
    expect(row.scholarshipAdjustedGap).toBe(-1276);
    expect(row.debtStatus).toBe("Manageable");
    expect(row.lifestyleSqueezeLabel).toBe("Squeezed");

    // Epic 13 / C2 — the income figure and the adjustment that explains it.
    expect(row.totalHouseholdNetIncome).toBe(72500);
    expect(row.manualAdjustment).toBe(12500);
    expect(row.manualAdjustmentReason).toBe(
      "Second parent's income added (separated household)"
    );

    // Legacy columns still populated via CALC-08's dual-write, so existing
    // readers (bursaryAward, yearlyPayableFees, monthlyPayableFees) keep working.
    expect(row.bursaryAward).toBe(15000);
    expect(row.yearlyPayableFees).toBe(15676);
    expect(row.monthlyPayableFees).toBe(1306.33);
  });

  it("handles a null assessment/recommendation gracefully (all blanks)", () => {
    const row = mapExportRow({
      reference: "JWF-0003",
      childName: null,
      school: "TRINITY",
      assessment: null,
    });

    expect(row.childFirstName).toBe("");
    expect(row.childLastName).toBe("");
    expect(row.familySynopsis).toBe("");
    expect(row.recommendedPayableFees).toBeNull();
    expect(row.gapReasons).toBe("");
    expect(row.mainGapReason).toBe("");
    expect(row.scholarshipAdjustedGap).toBeNull();
    expect(row.debtStatus).toBe("");
    expect(row.outcome).toBe("");
  });
});

describe("mapExportRow — flags and accommodation (17 Oct 2026)", () => {
  it("lists her six flags in her order, Large family from the family type", () => {
    const source = baseSource();
    source.assessment!.familyTypeCategory = 5;
    source.assessment!.recommendation = {
      ...source.assessment!.recommendation!,
      dishonestyFlag: true,
      acuteCrisisFlag: true,
      pastoralFlag: true,
    };
    expect(mapExportRow(source).flags).toBe("Dishonesty, Large family, Pastoral, Acute Crisis");
  });

  it("three children is not a large family", () => {
    const source = baseSource();
    source.assessment!.familyTypeCategory = 4;
    expect(mapExportRow(source).flags).toBe("");
  });

  it("takes Accommodation from the family's own/rent answer first", () => {
    const source = baseSource();
    source.sections = [{ data: { propertyOwnership: "RENT", rentAgreementType: "COUNCIL" } }];
    source.assessment!.property = { propertyAssets: { portfolioType: "SINGLE" } };
    expect(mapExportRow(source).accommodationType).toBe("Rents (council)");
  });

  it("falls back to the assessment for a record with no form", () => {
    const source = baseSource();
    source.assessment!.property = { propertyAssets: { portfolioType: "SINGLE" } };
    source.assessment!.rentAddBackType = "NONE";
    expect(mapExportRow(source).accommodationType).toBe("Owns home");
    source.assessment!.rentAddBackType = "FULL_RENT_FREE";
    expect(mapExportRow(source).accommodationType).toBe("Rent-free");
  });

  it("keeps a legacy stored value when nothing else says", () => {
    expect(mapExportRow(baseSource()).accommodationType).toBe("Renting");
  });
});
