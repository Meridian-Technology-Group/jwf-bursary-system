import { describe, it, expect } from "vitest";

import {
  buildPortalScheduleRows,
  type PortalScheduleEntryInput,
} from "../portal-schedule";
import { FINAL_ELIGIBLE_SCHOOL_YEAR } from "../schedule";

/**
 * Gap F2 — the pure Year 6 → Year 13 calendar derivation: span, greying, and
 * the current/next-year mark. No DB, no rendering — the same convention as the
 * other pure helper tests in this repo.
 */
describe("buildPortalScheduleRows — span (Yr6→13)", () => {
  it("renders every school year from the entry year to Year 13", () => {
    // Y7 entry, first assessed 2026/2027.
    const rows = buildPortalScheduleRows({
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      visibleEntries: [{ scheduleYear: 1, academicYear: "2026-27" }],
      currentAcademicYearStart: 2026,
    });

    // Year 7 → Year 13 inclusive = 7 rows.
    expect(rows.map((r) => r.schoolYear)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    expect(rows[0].academicYear).toBe("2026-27");
    expect(rows.at(-1)?.schoolYear).toBe(FINAL_ELIGIBLE_SCHOOL_YEAR);
    // Labels shift forward one academic year per row (admin-grid identical).
    expect(rows[1].academicYear).toBe("2027-28");
    expect(rows.at(-1)?.academicYear).toBe("2032-33");
  });

  it("starts the span at Year 6 for a Y6 entry", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: "Y6",
      firstAssessmentYear: "2026/2027",
      visibleEntries: [{ scheduleYear: 1, academicYear: "2026-27" }],
      currentAcademicYearStart: 2026,
    });
    expect(rows[0].schoolYear).toBe(6);
    expect(rows).toHaveLength(8); // Years 6..13
  });

  it("returns no rows when the first-assessment year can't be parsed", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: "Y7",
      firstAssessmentYear: "n/a",
      visibleEntries: [],
      currentAcademicYearStart: 2026,
    });
    expect(rows).toEqual([]);
  });
});

describe("buildPortalScheduleRows — greyed vs active vs current", () => {
  // Y7 entry (Year 7 → 13), first assessed 2026/2027.
  // Portal-visible entries: schedule years 1 & 2 (academic 2026-27, 2027-28).
  const visible: PortalScheduleEntryInput[] = [
    { scheduleYear: 1, academicYear: "2026-27" },
    { scheduleYear: 2, academicYear: "2027-28" },
  ];

  it("greys a year that is outside the award (no portal-visible entry)", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      visibleEntries: visible,
      currentAcademicYearStart: 2026,
    });

    // Years 9..13 (school years 9-13) have no showOnPortal entry → greyed.
    const greyed = rows.filter((r) => r.state === "greyed");
    expect(greyed.map((r) => r.schoolYear)).toEqual([9, 10, 11, 12, 13]);
    expect(greyed.every((r) => r.stateLabel === "Outside your award")).toBe(
      true
    );
  });

  it("marks the current assessment year distinctly (exactly one)", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      visibleEntries: visible,
      currentAcademicYearStart: 2026,
    });

    const current = rows.filter((r) => r.state === "current");
    expect(current).toHaveLength(1);
    expect(current[0].schoolYear).toBe(7); // 2026-27 is the current year
    expect(current[0].academicYear).toBe("2026-27");

    // The other visible year (2027-28) is active-but-not-current.
    const active = rows.filter((r) => r.state === "active");
    expect(active.map((r) => r.academicYear)).toEqual(["2027-28"]);
  });

  it("treats the EARLIEST upcoming visible year as current when 'now' is before the award", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      visibleEntries: visible,
      currentAcademicYearStart: 2025, // before the first visible year
    });
    const current = rows.find((r) => r.state === "current");
    expect(current?.academicYear).toBe("2026-27");
  });

  it("falls back to the latest visible year as current when all are in the past", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      visibleEntries: visible,
      currentAcademicYearStart: 2030, // after every visible year
    });
    const current = rows.find((r) => r.state === "current");
    expect(current?.academicYear).toBe("2027-28");
  });
});

describe("buildPortalScheduleRows — OTHER/null entry group", () => {
  const visible: PortalScheduleEntryInput[] = [
    { scheduleYear: 1, academicYear: "2026-27" },
    { scheduleYear: 2, academicYear: "2027-28" },
  ];

  it("renders ONLY the visible entries with NO 'Year N' school-year label", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: "OTHER",
      firstAssessmentYear: "2026/2027",
      visibleEntries: visible,
      currentAcademicYearStart: 2026,
    });

    // One row per visible entry — no synthetic Yr1..N span, no greyed padding.
    expect(rows).toHaveLength(2);
    // No misleading school-year number: every row has schoolYear === null.
    expect(rows.every((r) => r.schoolYear === null)).toBe(true);
    // Real academic-year labels are still surfaced.
    expect(rows.map((r) => r.academicYear)).toEqual(["2026-27", "2027-28"]);
    // Current/active marking still works off the academic year.
    expect(rows[0].state).toBe("current");
    expect(rows[1].state).toBe("active");
    // No "Outside your award" / greyed rows are invented for OTHER groups.
    expect(rows.some((r) => r.state === "greyed")).toBe(false);
  });

  it("treats a null entry group the same as OTHER (graceful, no crash)", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: null,
      firstAssessmentYear: "2026/2027",
      visibleEntries: visible,
      currentAcademicYearStart: 2026,
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.schoolYear === null)).toBe(true);
  });

  it("renders an empty calendar (not a crash) when an OTHER group has no visible entries", () => {
    const rows = buildPortalScheduleRows({
      entryYearGroup: "OTHER",
      firstAssessmentYear: "2026/2027",
      visibleEntries: [],
      currentAcademicYearStart: 2026,
    });
    expect(rows).toEqual([]);
  });
});
