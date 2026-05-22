import { describe, it, expect } from "vitest";
import {
  academicYearStartForDate,
  calculateSchoolingYearsRemaining,
  calculateSchoolingYearsRemainingFromEntry,
  deriveCurrentYearGroupNumber,
  getTotalSchoolingYears,
  getTotalSchoolingYearsForGroup,
} from "../schooling-years";

// Fixed reference dates so tests don't depend on the system clock.
// The UK academic year rolls over in September (month index >= 8).
const OCT_2026 = new Date("2026-10-01"); // academic year start 2026
const MAR_2026 = new Date("2026-03-01"); // academic year start 2025
const OCT_2025 = new Date("2025-10-01"); // academic year start 2025

describe("academicYearStartForDate", () => {
  it("returns the calendar year for September onwards", () => {
    expect(academicYearStartForDate(OCT_2026)).toBe(2026);
  });
  it("returns the previous year before September", () => {
    expect(academicYearStartForDate(MAR_2026)).toBe(2025);
    expect(academicYearStartForDate(new Date("2026-08-31"))).toBe(2025);
    expect(academicYearStartForDate(new Date("2026-09-01"))).toBe(2026);
  });
});

describe("getTotalSchoolingYearsForGroup", () => {
  it("maps each year-group to its total schooling years", () => {
    expect(getTotalSchoolingYearsForGroup("Y6")).toBe(7);
    expect(getTotalSchoolingYearsForGroup("Y7")).toBe(6);
    expect(getTotalSchoolingYearsForGroup("Y9")).toBe(4);
    expect(getTotalSchoolingYearsForGroup("Y12")).toBe(1);
  });
  it("returns null for OTHER / null / undefined (manual entry)", () => {
    expect(getTotalSchoolingYearsForGroup("OTHER")).toBeNull();
    expect(getTotalSchoolingYearsForGroup(null)).toBeNull();
    expect(getTotalSchoolingYearsForGroup(undefined)).toBeNull();
  });
  it("agrees with the group-number lib for the canonical mapping", () => {
    expect(getTotalSchoolingYearsForGroup("Y7")).toBe(getTotalSchoolingYears(7));
  });
});

describe("calculateSchoolingYearsRemainingFromEntry", () => {
  it("returns the full total in the entry year (nothing elapsed)", () => {
    expect(calculateSchoolingYearsRemainingFromEntry("Y7", 2026, OCT_2026)).toBe(6);
  });

  it("subtracts elapsed academic years", () => {
    // Entered Y7 (6 total) in calendar 2025; now academic 2026 → 1 elapsed → 5.
    expect(calculateSchoolingYearsRemainingFromEntry("Y7", 2025, OCT_2026)).toBe(5);
  });

  it("distinguishes same-group cohorts by entry calendar year", () => {
    // The crux of the year-group model: Y7-in-2025 vs Y7-in-2026 differ.
    const lastYearCohort = calculateSchoolingYearsRemainingFromEntry("Y7", 2025, OCT_2026);
    const thisYearCohort = calculateSchoolingYearsRemainingFromEntry("Y7", 2026, OCT_2026);
    expect(lastYearCohort).toBe(5);
    expect(thisYearCohort).toBe(6);
  });

  it("floors at 0 when more years elapse than the total", () => {
    expect(calculateSchoolingYearsRemainingFromEntry("Y12", 2020, OCT_2026)).toBe(0);
  });

  it("returns null for OTHER or an unknown entry calendar year", () => {
    expect(calculateSchoolingYearsRemainingFromEntry("OTHER", 2025, OCT_2026)).toBeNull();
    expect(calculateSchoolingYearsRemainingFromEntry("Y7", null, OCT_2026)).toBeNull();
    expect(calculateSchoolingYearsRemainingFromEntry(null, 2025, OCT_2026)).toBeNull();
  });
});

describe("deriveCurrentYearGroupNumber", () => {
  it("advances the year-group by elapsed academic years", () => {
    // Entered Y7 in calendar 2025; now academic 2026 → Y8.
    expect(deriveCurrentYearGroupNumber("Y7", 2025, OCT_2026)).toBe(8);
  });

  it("equals the entry group in the entry year", () => {
    expect(deriveCurrentYearGroupNumber("Y7", 2025, OCT_2025)).toBe(7);
    expect(deriveCurrentYearGroupNumber("Y12", 2025, OCT_2025)).toBe(12);
  });

  it("returns null for OTHER or an unknown entry calendar year", () => {
    expect(deriveCurrentYearGroupNumber("OTHER", 2025, OCT_2026)).toBeNull();
    expect(deriveCurrentYearGroupNumber("Y7", null, OCT_2026)).toBeNull();
  });
});

describe("calculateSchoolingYearsRemaining (existing group-number API)", () => {
  it("subtracts elapsed assessment cycles from the total", () => {
    // Year 7 entry → 6 total; first assessed 2023-24, now 2025-26 → 4 left.
    expect(calculateSchoolingYearsRemaining(7, "2025-26", "2023-24")).toBe(4);
  });
  it("floors at 0", () => {
    expect(calculateSchoolingYearsRemaining(12, "2030-31", "2025-26")).toBe(0);
  });
});
