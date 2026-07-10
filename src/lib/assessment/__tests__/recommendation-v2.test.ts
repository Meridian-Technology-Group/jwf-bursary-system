import { describe, it, expect } from "vitest";
import {
  GAP_TOLERANCE,
  computeGapAmount,
  hasMaterialGap,
  gapReasonSelectionValid,
  selectLastPayableFees,
  resolveNextYearFees,
  deriveRecommendationAward,
} from "../recommendation-v2";
import { awardSummary } from "../v2/award";

describe("computeGapAmount", () => {
  it("is confirmed − recommended, rounded to the penny", () => {
    expect(computeGapAmount(15676, 12000)).toBe(3676);
    expect(computeGapAmount(12000, 15676)).toBe(-3676);
    // Rounds to the penny (and absorbs binary-float drift).
    expect(computeGapAmount(12345.67, 12000)).toBe(345.67);
  });
});

describe("hasMaterialGap (tolerance)", () => {
  it("treats a zero / sub-penny gap as immaterial", () => {
    expect(hasMaterialGap(0)).toBe(false);
    expect(hasMaterialGap(0.01)).toBe(false); // exactly the tolerance is NOT material
    expect(hasMaterialGap(-0.01)).toBe(false);
    expect(hasMaterialGap(null)).toBe(false);
    expect(hasMaterialGap(undefined)).toBe(false);
  });

  it("treats a gap beyond the tolerance as material (either sign)", () => {
    expect(hasMaterialGap(0.02)).toBe(true);
    expect(hasMaterialGap(-500)).toBe(true);
    expect(hasMaterialGap(3676)).toBe(true);
  });

  it("exposes the tolerance constant", () => {
    expect(GAP_TOLERANCE).toBe(0.01);
  });
});

describe("gapReasonSelectionValid (CALC-08 requirement)", () => {
  it("is valid when there is no material gap, regardless of reasons", () => {
    expect(gapReasonSelectionValid(0, [])).toBe(true);
    expect(gapReasonSelectionValid(0.01, [])).toBe(true);
    expect(gapReasonSelectionValid(null, [])).toBe(true);
  });

  it("rejects a material gap with no reason selected", () => {
    expect(gapReasonSelectionValid(3676, [])).toBe(false);
    expect(gapReasonSelectionValid(-500, [])).toBe(false);
  });

  it("accepts a material gap with ≥1 reason selected", () => {
    expect(gapReasonSelectionValid(3676, ["gap-reason-1"])).toBe(true);
    expect(gapReasonSelectionValid(-500, ["a", "b"])).toBe(true);
  });
});

describe("selectLastPayableFees", () => {
  it("returns null for a first assessment (no previous recommendation)", () => {
    expect(selectLastPayableFees(null)).toBeNull();
  });

  it("prefers the previous confirmed figure", () => {
    expect(
      selectLastPayableFees({
        confirmedPayableFees: 15676,
        recommendedPayableFees: 12000,
        yearlyPayableFees: 9000,
      })
    ).toBe(15676);
  });

  it("falls back to recommended, then to legacy yearly", () => {
    expect(
      selectLastPayableFees({
        confirmedPayableFees: null,
        recommendedPayableFees: 12000,
        yearlyPayableFees: 9000,
      })
    ).toBe(12000);
    expect(
      selectLastPayableFees({
        confirmedPayableFees: null,
        recommendedPayableFees: null,
        yearlyPayableFees: 9000,
      })
    ).toBe(9000);
    expect(
      selectLastPayableFees({
        confirmedPayableFees: null,
        recommendedPayableFees: null,
        yearlyPayableFees: null,
      })
    ).toBeNull();
  });
});

describe("resolveNextYearFees", () => {
  it("prefers the persisted next-year fee", () => {
    expect(resolveNextYearFees({ nextYearAnnualFees: 31450, annualFees: 30240 })).toEqual({
      fees: 31450,
      usingCurrentYearFee: false,
    });
  });

  it("falls back to the current-year fee and flags it", () => {
    expect(resolveNextYearFees({ nextYearAnnualFees: null, annualFees: 30240 })).toEqual({
      fees: 30240,
      usingCurrentYearFee: true,
    });
    expect(resolveNextYearFees({ nextYearAnnualFees: 0, annualFees: 30240 })).toEqual({
      fees: 30240,
      usingCurrentYearFee: true,
    });
  });

  it("returns 0 fees (flagged) when neither is present", () => {
    expect(resolveNextYearFees({ nextYearAnnualFees: null, annualFees: null })).toEqual({
      fees: 0,
      usingCurrentYearFee: true,
    });
  });
});

describe("deriveRecommendationAward (awardSummary wiring)", () => {
  it("matches the engine's awardSummary output exactly (workbook Appendix F vector 6)", () => {
    // fees 31450, scholarship 10%, bursary (after VAT) 12000, VAT 20% →
    // scholarship value 3774; payable 31450 − 3774 − 12000 = 15676;
    // spend-before-VAT 10000.
    const derived = deriveRecommendationAward({
      nextYearFees: 31450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 12000,
      confirmedPayableFees: 15676,
      recommendedPayableFees: 12000,
      vatRate: 20,
    });

    const expected = awardSummary({
      nextYearFees: 31450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 12000,
      vatRate: 20,
      confirmedPayableFees: 15676,
      recommendedPayableFees: 12000,
    });

    expect(derived).toEqual(expected);
    expect(derived.scholarshipValueInclVat).toBe(3774);
    expect(derived.payableFeesNextYear).toBe(15676);
    expect(derived.bursarySpendBeforeVat).toBe(10000);
  });

  it("VAT identity holds: spendBeforeVat × 1.2 === award", () => {
    const derived = deriveRecommendationAward({
      nextYearFees: 30000,
      scholarshipPct: 0,
      bursaryAwardAfterVat: 12000,
      confirmedPayableFees: 0,
      recommendedPayableFees: 0,
      vatRate: 20,
    });
    expect(Math.round(derived.bursarySpendBeforeVat * 1.2 * 100) / 100).toBe(12000);
  });

  it("defaults the VAT rate when omitted", () => {
    const derived = deriveRecommendationAward({
      nextYearFees: 31450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 12000,
      confirmedPayableFees: 15676,
      recommendedPayableFees: 12000,
    });
    expect(derived.scholarshipValueInclVat).toBe(3774);
  });
});
