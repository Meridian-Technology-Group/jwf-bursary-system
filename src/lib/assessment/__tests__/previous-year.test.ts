import { describe, it, expect } from "vitest";
import {
  isEarlierAcademicYear,
  pickPreviousYear,
  scheduleRowLink,
} from "../previous-year";

describe("isEarlierAcademicYear (Epic 21 #3)", () => {
  it("compares on the start year", () => {
    expect(isEarlierAcademicYear("2026/27", "2027/28")).toBe(true);
    expect(isEarlierAcademicYear("2027/28", "2026/27")).toBe(false);
  });

  it("treats the round and schedule spellings of one year as the same year", () => {
    expect(isEarlierAcademicYear("2026-27", "2026/27")).toBe(false);
    expect(isEarlierAcademicYear("2026/27", "2026-27")).toBe(false);
    expect(isEarlierAcademicYear("2025-26", "2026/27")).toBe(true);
  });

  it("is false for an unparseable year", () => {
    expect(isEarlierAcademicYear("unknown", "2026/27")).toBe(false);
    expect(isEarlierAcademicYear("2026/27", "")).toBe(false);
  });
});

describe("pickPreviousYear", () => {
  const y2425 = { id: "a", academicYear: "2024/25", submittedAt: new Date("2024-05-01") };
  const y2526 = { id: "b", academicYear: "2025/26", submittedAt: new Date("2025-05-01") };
  const y2728 = { id: "d", academicYear: "2027/28", submittedAt: new Date("2027-05-01") };

  it("picks the latest EARLIER year", () => {
    expect(pickPreviousYear([y2425, y2526, y2728], "2026/27")?.id).toBe("b");
  });

  it("never picks a later year as previous (viewing an older year)", () => {
    expect(pickPreviousYear([y2526, y2728], "2025/26")).toBeNull();
    expect(pickPreviousYear([y2425, y2728], "2025/26")?.id).toBe("a");
  });

  it("orders by academic year, not by submission date", () => {
    // 2024/25 submitted late (after 2025/26) is still not the previous year.
    const late2425 = { ...y2425, submittedAt: new Date("2025-09-01") };
    expect(pickPreviousYear([late2425, y2526], "2026/27")?.id).toBe("b");
  });

  it("within one year, prefers the latest submission and puts a missing date last", () => {
    const unsubmitted = { id: "x", academicYear: "2025/26", submittedAt: null };
    expect(pickPreviousYear([unsubmitted, y2526], "2026/27")?.id).toBe("b");
  });

  it("is null with no candidates", () => {
    expect(pickPreviousYear([], "2026/27")).toBeNull();
  });
});

describe("scheduleRowLink", () => {
  it("marks the application being viewed as the current year", () => {
    expect(scheduleRowLink({ applicationId: "app-1" }, "app-1")).toEqual({ kind: "current" });
  });

  it("links another year's application to its assessment", () => {
    expect(scheduleRowLink({ applicationId: "app-0" }, "app-1")).toEqual({
      kind: "link",
      href: "/applications/app-0/assessment",
    });
  });

  it("shows plain text for a year with no (visible) application", () => {
    expect(scheduleRowLink({ applicationId: null }, "app-1")).toEqual({ kind: "none" });
  });
});
