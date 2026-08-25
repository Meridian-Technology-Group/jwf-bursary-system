import { describe, it, expect } from "vitest";
import {
  academicYearStartYear,
  getTaxYearLabels,
} from "@/lib/portal/tax-year";

describe("academicYearStartYear", () => {
  it.each([
    ["2026/27", 2026],
    ["2025/2026", 2025],
    ["2024-25", 2024],
    ["2024", 2024],
    ["  2027/28 ", 2027],
  ])("parses %s → %i", (input, expected) => {
    expect(academicYearStartYear(input)).toBe(expected);
  });

  it("falls back to the current year on a malformed value", () => {
    const now = new Date().getUTCFullYear();
    expect(academicYearStartYear("not-a-year")).toBe(now);
    expect(academicYearStartYear(null)).toBe(now);
    expect(academicYearStartYear(undefined)).toBe(now);
    expect(academicYearStartYear("")).toBe(now);
  });
});

describe("getTaxYearLabels", () => {
  it("derives every label from the round start year (D5)", () => {
    const labels = getTaxYearLabels("2026/27");
    expect(labels.startYear).toBe(2026);
    expect(labels.financialYearEndedLabel).toBe(
      "financial year ended 4 April 2026"
    );
    expect(labels.financialYearEndDateLabel).toBe("4 April 2026");
    expect(labels.p60DateLabel).toBe("April 2026");
    expect(labels.marchPayslipLabel).toBe("March 2026 payslip");
    expect(labels.sa302TaxYearLabel).toBe("2025/26");
    // CH-47 — the arrears year the self-employed footnote now names, one behind.
    expect(labels.sa302ArrearsTaxYearLabel).toBe("2024/25");
    expect(labels.leftEmploymentSinceLabel).toBe("since April 2026");
  });

  it("two-digit suffix handles a turn of the century", () => {
    expect(getTaxYearLabels("2100/01").sa302TaxYearLabel).toBe("2099/00");
    expect(getTaxYearLabels("2100/01").sa302ArrearsTaxYearLabel).toBe("2098/99");
  });

  it("never hard-codes a year — different rounds give different labels", () => {
    const a = getTaxYearLabels("2026/27");
    const b = getTaxYearLabels("2027/28");
    expect(a.marchPayslipLabel).not.toBe(b.marchPayslipLabel);
  });
});

// ─── CH-47 — the self-employed arrears year ────────────────────────────────

describe("CH-47 — sa302ArrearsTaxYearLabel", () => {
  it("is always exactly one tax year behind the primary SA302 label", () => {
    // The relationship is what matters, not the literals: a self-employed
    // parent reporting in arrears files the year before the one everyone else
    // reports. Asserting the gap catches a drift in either label.
    for (const year of ["2024/25", "2025/26", "2026/27", "2030/31"]) {
      const labels = getTaxYearLabels(year);
      const primaryStart = Number.parseInt(labels.sa302TaxYearLabel.slice(0, 4), 10);
      const arrearsStart = Number.parseInt(
        labels.sa302ArrearsTaxYearLabel.slice(0, 4),
        10
      );
      expect(primaryStart - arrearsStart).toBe(1);
    }
  });

  it("pads the two-digit suffix across a century boundary", () => {
    expect(getTaxYearLabels("2101/02").sa302ArrearsTaxYearLabel).toBe("2099/00");
  });

  it("derives from the round, like every other label (D5)", () => {
    expect(getTaxYearLabels("2026/27").sa302ArrearsTaxYearLabel).toBe("2024/25");
    expect(getTaxYearLabels("2027/28").sa302ArrearsTaxYearLabel).toBe("2025/26");
  });
});
