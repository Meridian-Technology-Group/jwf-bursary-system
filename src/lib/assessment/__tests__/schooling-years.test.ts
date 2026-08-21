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
  it("maps each year-group to its total schooling years (to Year 13)", () => {
    // Total = 13 − entryYear + 1 (inclusive of entry and final Year 13).
    expect(getTotalSchoolingYearsForGroup("Y6")).toBe(8);
    expect(getTotalSchoolingYearsForGroup("Y7")).toBe(7);
    expect(getTotalSchoolingYearsForGroup("Y9")).toBe(5);
    expect(getTotalSchoolingYearsForGroup("Y12")).toBe(2);
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
    // Y7 → 7 total (Years 7–13); entered & assessed 2026 → 0 elapsed → 7.
    expect(calculateSchoolingYearsRemainingFromEntry("Y7", 2026, OCT_2026)).toBe(7);
  });

  it("subtracts elapsed academic years", () => {
    // Entered Y7 (7 total) in calendar 2025; now academic 2026 → 1 elapsed → 6.
    expect(calculateSchoolingYearsRemainingFromEntry("Y7", 2025, OCT_2026)).toBe(6);
  });

  it("distinguishes same-group cohorts by entry calendar year", () => {
    // The crux of the year-group model: Y7-in-2025 vs Y7-in-2026 differ.
    const lastYearCohort = calculateSchoolingYearsRemainingFromEntry("Y7", 2025, OCT_2026);
    const thisYearCohort = calculateSchoolingYearsRemainingFromEntry("Y7", 2026, OCT_2026);
    expect(lastYearCohort).toBe(6);
    expect(thisYearCohort).toBe(7);
  });

  it("floors at 0 when more years elapse than the total", () => {
    // Y12 → 2 total; entered 2020, assessed 2026 → 6 elapsed → floored to 0.
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
    // Year 7 entry → 7 total (Years 7–13); first assessed 2023-24, now 2025-26
    // → 2 elapsed → 5 left.
    expect(calculateSchoolingYearsRemaining(7, "2025-26", "2023-24")).toBe(5);
  });
  it("floors at 0", () => {
    // Year 12 entry → 2 total; first 2025-26, now 2030-31 → 5 elapsed → 0.
    expect(calculateSchoolingYearsRemaining(12, "2030-31", "2025-26")).toBe(0);
  });
});

// ── Epic 15 M1 (CH-12): the full Year 6–13 → remaining-years matrix ─────────
import { remainingYearsForEntrySchoolYear } from "../schooling-years";

describe("remainingYearsForEntrySchoolYear (CH-12 matrix)", () => {
  it("matches Charlotte's matrix exactly (Y6→8 … Y13→1)", () => {
    const expected: Array<[number, number]> = [
      [6, 8],
      [7, 7],
      [8, 6],
      [9, 5],
      [10, 4],
      [11, 3],
      [12, 2],
      [13, 1],
    ];
    for (const [entry, remaining] of expected) {
      expect(remainingYearsForEntrySchoolYear(entry)).toBe(remaining);
    }
  });

  it("out-of-range or missing input yields null (no autofill)", () => {
    expect(remainingYearsForEntrySchoolYear(5)).toBeNull();
    expect(remainingYearsForEntrySchoolYear(14)).toBeNull();
    expect(remainingYearsForEntrySchoolYear(7.5)).toBeNull();
    expect(remainingYearsForEntrySchoolYear(null)).toBeNull();
    expect(remainingYearsForEntrySchoolYear(undefined)).toBeNull();
  });
});
