import { describe, it, expect } from "vitest";
import {
  buildYoyFinancialsTable,
  type YoyFinancialsInputRow,
} from "@/lib/assessment/yoy-financials";

function row(overrides: Partial<YoyFinancialsInputRow>): YoyFinancialsInputRow {
  return {
    applicationId: "app-1",
    applicationReference: "REF-1",
    academicYear: "2024/25",
    completedAt: new Date("2025-01-01T00:00:00Z"),
    totalHouseholdNetIncome: 50_000,
    manualAdjustment: null,
    cashSavings: 10_000,
    isasPepsShares: 5_000,
    propertyAssets: null,
    yearlyDebtExposure: null,
    lifestyleSqueezeLabel: null,
    ...overrides,
  };
}

describe("buildYoyFinancialsTable — CALC-10 YoY financials history", () => {
  it("returns an empty array for no rows", () => {
    expect(buildYoyFinancialsTable([])).toEqual([]);
  });

  it("the first row always has null deltas", () => {
    const [out] = buildYoyFinancialsTable([row({})]);
    expect(out.deltaTotalHouseholdNetIncome).toBeNull();
    expect(out.deltaTotalCashSavings).toBeNull();
    expect(out.deltaTotalPropertyEquity).toBeNull();
    expect(out.deltaYearlyDebtExposure).toBeNull();
  });

  it("sums cashSavings + isasPepsShares into totalCashSavings", () => {
    const [out] = buildYoyFinancialsTable([
      row({ cashSavings: 12_000, isasPepsShares: 3_000 }),
    ]);
    expect(out.totalCashSavings).toBe(15_000);
  });

  it("sorts chronologically ascending by completedAt regardless of input order", () => {
    const rows = [
      row({
        applicationId: "app-2025",
        academicYear: "2025/26",
        completedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      row({
        applicationId: "app-2023",
        academicYear: "2023/24",
        completedAt: new Date("2024-01-01T00:00:00Z"),
      }),
      row({
        applicationId: "app-2024",
        academicYear: "2024/25",
        completedAt: new Date("2025-01-01T00:00:00Z"),
      }),
    ];
    const out = buildYoyFinancialsTable(rows);
    expect(out.map((r) => r.applicationId)).toEqual([
      "app-2023",
      "app-2024",
      "app-2025",
    ]);
  });

  it("computes YoY deltas as current − previous for numeric columns", () => {
    const rows = [
      row({
        applicationId: "y1",
        completedAt: new Date("2024-01-01T00:00:00Z"),
        totalHouseholdNetIncome: 40_000,
        cashSavings: 5_000,
        isasPepsShares: 0,
        yearlyDebtExposure: 2_000,
      }),
      row({
        applicationId: "y2",
        completedAt: new Date("2025-01-01T00:00:00Z"),
        totalHouseholdNetIncome: 45_000,
        cashSavings: 4_000,
        isasPepsShares: 0,
        yearlyDebtExposure: 1_000,
      }),
    ];
    const [, second] = buildYoyFinancialsTable(rows);
    expect(second.deltaTotalHouseholdNetIncome).toBe(5_000);
    expect(second.deltaTotalCashSavings).toBe(-1_000);
    expect(second.deltaYearlyDebtExposure).toBe(-1_000);
  });

  it("derives total property equity from the v2 propertyAssets JSONB totals", () => {
    const [out] = buildYoyFinancialsTable([
      row({
        propertyAssets: {
          home: { value: 500_000, mortgageBalance: 300_000 },
          second: { value: 200_000, mortgageBalance: 0 },
        },
      }),
    ]);
    // home equity 200,000 + second equity 200,000
    expect(out.totalPropertyEquity).toBe(400_000);
  });

  it("is null-safe for v1 rows: property equity, debt exposure and squeeze label are null, not 0", () => {
    const [out] = buildYoyFinancialsTable([
      row({
        propertyAssets: null,
        yearlyDebtExposure: null,
        lifestyleSqueezeLabel: null,
      }),
    ]);
    expect(out.totalPropertyEquity).toBeNull();
    expect(out.yearlyDebtExposure).toBeNull();
    expect(out.lifestyleSqueezeLabel).toBeNull();
  });

  it("delta is null when EITHER side is null (e.g. v1 row followed by v2 row)", () => {
    const rows = [
      row({
        applicationId: "v1-row",
        completedAt: new Date("2024-01-01T00:00:00Z"),
        propertyAssets: null,
        yearlyDebtExposure: null,
      }),
      row({
        applicationId: "v2-row",
        completedAt: new Date("2025-01-01T00:00:00Z"),
        propertyAssets: { home: { value: 400_000, mortgageBalance: 100_000 } },
        yearlyDebtExposure: 3_000,
      }),
    ];
    const [, second] = buildYoyFinancialsTable(rows);
    // v1 row had no equity/debt figures to compare against.
    expect(second.deltaTotalPropertyEquity).toBeNull();
    expect(second.deltaYearlyDebtExposure).toBeNull();
    // but the v2 row's own values are still populated.
    expect(second.totalPropertyEquity).toBe(300_000);
    expect(second.yearlyDebtExposure).toBe(3_000);
  });

  it("totalCashSavings is null only when BOTH cashSavings and isasPepsShares are null (no property row at all)", () => {
    const [out] = buildYoyFinancialsTable([
      row({ cashSavings: null, isasPepsShares: null }),
    ]);
    expect(out.totalCashSavings).toBeNull();

    const [partial] = buildYoyFinancialsTable([
      row({ cashSavings: 1_000, isasPepsShares: null }),
    ]);
    expect(partial.totalCashSavings).toBe(1_000);
  });

  it("does not mutate the input array", () => {
    const rows = [
      row({ applicationId: "a", completedAt: new Date("2025-01-01T00:00:00Z") }),
      row({ applicationId: "b", completedAt: new Date("2024-01-01T00:00:00Z") }),
    ];
    const copy = [...rows];
    buildYoyFinancialsTable(rows);
    expect(rows).toEqual(copy);
  });

  it("preserves lifestyle squeeze label verbatim for v2 rows", () => {
    const [out] = buildYoyFinancialsTable([
      row({ lifestyleSqueezeLabel: "Significant squeeze" }),
    ]);
    expect(out.lifestyleSqueezeLabel).toBe("Significant squeeze");
  });
});
