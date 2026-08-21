import { describe, it, expect, vi } from "vitest";
import { getPreviousAssessment } from "../reassessment";
import type { Tx } from "@/lib/db/prisma";

/**
 * CALC-12 — `getPreviousAssessment` (feeds the `YearComparison` panel on the
 * assessment page) must not show blank "—" award/fee rows for a previous-year
 * v2 assessment. A v2 assessment never writes the legacy
 * `assessment.bursaryAward` / `yearlyPayableFees` / `monthlyPayableFees`
 * columns directly (those are v1-only `calculator.ts` outputs) — the
 * confirmed v2 figures are dual-written onto `Recommendation` instead
 * (`recommendation-form-v2.tsx`). Same fallback-walk pattern as
 * `getSchoolComparison` / `account-promotion.ts`: prefer the recommendation's
 * dual-written figure, fall back to the legacy assessment column.
 */

interface FakeAssessment {
  totalHouseholdNetIncome: number | null;
  netAssetsYearlyValuation: number | null;
  hndiAfterNs: number | null;
  requiredBursary: number | null;
  grossFees: number | null;
  bursaryAward: number | null;
  yearlyPayableFees: number | null;
  monthlyPayableFees: number | null;
  schoolingYearsRemaining: number | null;
  recommendation: {
    bursaryAward: number | null;
    yearlyPayableFees: number | null;
    monthlyPayableFees: number | null;
  } | null;
}

function makeFakeTx(assessment: FakeAssessment | null): Tx {
  return {
    application: {
      findFirst: vi.fn(async () =>
        assessment === null
          ? null
          : {
              reference: "JWF-PREV",
              round: { academicYear: "2025/2026" },
              assessment,
            }
      ),
    },
  } as unknown as Tx;
}

describe("getPreviousAssessment — v1/v2 fallback walk (CALC-12)", () => {
  it("prefers the recommendation's dual-written figures for a v2 assessment (legacy columns null)", async () => {
    const tx = makeFakeTx({
      totalHouseholdNetIncome: 45000,
      netAssetsYearlyValuation: null,
      hndiAfterNs: null,
      requiredBursary: null,
      grossFees: null,
      bursaryAward: null,
      yearlyPayableFees: null,
      monthlyPayableFees: null,
      schoolingYearsRemaining: 5,
      recommendation: {
        bursaryAward: 15000,
        yearlyPayableFees: 15676,
        monthlyPayableFees: 1306.33,
      },
    });

    const result = await getPreviousAssessment(tx, "account-1", "round-current");

    expect(result).not.toBeNull();
    expect(result?.bursaryAward).toBe("15000");
    expect(result?.yearlyPayableFees).toBe("15676");
    expect(result?.monthlyPayableFees).toBe("1306.33");
  });

  it("falls back to the legacy assessment columns for a v1 assessment (no recommendation dual-write needed)", async () => {
    const tx = makeFakeTx({
      totalHouseholdNetIncome: 45000,
      netAssetsYearlyValuation: 20000,
      hndiAfterNs: 5000,
      requiredBursary: 8000,
      grossFees: 20000,
      bursaryAward: 12000,
      yearlyPayableFees: 8000,
      monthlyPayableFees: 666.67,
      schoolingYearsRemaining: 5,
      recommendation: {
        // Mirrors v1: the recommendation carries the same figures once saved.
        bursaryAward: 12000,
        yearlyPayableFees: 8000,
        monthlyPayableFees: 666.67,
      },
    });

    const result = await getPreviousAssessment(tx, "account-1", "round-current");

    expect(result?.bursaryAward).toBe("12000");
    expect(result?.yearlyPayableFees).toBe("8000");
    expect(result?.monthlyPayableFees).toBe("666.67");
  });

  it("falls back to the legacy assessment columns when no recommendation exists yet", async () => {
    const tx = makeFakeTx({
      totalHouseholdNetIncome: 45000,
      netAssetsYearlyValuation: 20000,
      hndiAfterNs: 5000,
      requiredBursary: 8000,
      grossFees: 20000,
      bursaryAward: 12000,
      yearlyPayableFees: 8000,
      monthlyPayableFees: 666.67,
      schoolingYearsRemaining: 5,
      recommendation: null,
    });

    const result = await getPreviousAssessment(tx, "account-1", "round-current");

    expect(result?.bursaryAward).toBe("12000");
    expect(result?.yearlyPayableFees).toBe("8000");
    expect(result?.monthlyPayableFees).toBe("666.67");
  });

  it("returns null when there is no previous assessment", async () => {
    const tx = makeFakeTx(null);
    const result = await getPreviousAssessment(tx, "account-1", "round-current");
    expect(result).toBeNull();
  });
});
