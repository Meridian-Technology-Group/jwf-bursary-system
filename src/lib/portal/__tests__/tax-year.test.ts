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
    expect(labels.leftEmploymentSinceLabel).toBe("since April 2026");
  });

  it("two-digit suffix handles a turn of the century", () => {
    expect(getTaxYearLabels("2100/01").sa302TaxYearLabel).toBe("2099/00");
  });

  it("never hard-codes a year — different rounds give different labels", () => {
    const a = getTaxYearLabels("2026/27");
    const b = getTaxYearLabels("2027/28");
    expect(a.marchPayslipLabel).not.toBe(b.marchPayslipLabel);
  });
});
