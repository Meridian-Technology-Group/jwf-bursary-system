import { describe, it, expect } from "vitest";
import { childYearLine, currentSchoolYear } from "../current-school-year";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("currentSchoolYear (Epic 22 P4)", () => {
  const y8 = { entryYearGroup: "Y8", firstAssessmentYear: "2026-27", school: "TRINITY" };

  it("TS-NOWS01's three accounts in 2026-27: Year 8, Year 11, Year 13", () => {
    const today = at("2026-10-14");
    expect(currentSchoolYear({ ...y8, today })).toEqual({ kind: "current", year: 8 });
    expect(currentSchoolYear({ ...y8, entryYearGroup: "Y11", today })).toEqual({
      kind: "current",
      year: 11,
    });
    expect(currentSchoolYear({ ...y8, entryYearGroup: "Y13", today })).toEqual({
      kind: "current",
      year: 13,
    });
  });

  it("moves up a year on 20 August, not 1 September", () => {
    expect(currentSchoolYear({ ...y8, today: at("2027-08-19") })).toEqual({
      kind: "current",
      year: 8,
    });
    expect(currentSchoolYear({ ...y8, today: at("2027-08-20") })).toEqual({
      kind: "current",
      year: 9,
    });
  });

  it("accepts the slash form of the academic year", () => {
    expect(
      currentSchoolYear({ ...y8, firstAssessmentYear: "2026/27", today: at("2027-10-01") })
    ).toEqual({ kind: "current", year: 9 });
  });

  it("caps at the school's final year (13; 11 at the OP partnering school)", () => {
    expect(
      currentSchoolYear({ ...y8, entryYearGroup: "Y13", today: at("2028-10-01") })
    ).toEqual({ kind: "current", year: 13 });
    expect(
      currentSchoolYear({
        ...y8,
        entryYearGroup: "Y10",
        school: "OP_PARTNER",
        today: at("2028-10-01"),
      })
    ).toEqual({ kind: "current", year: 11 });
  });

  it("an award that starts next year: not at the school yet", () => {
    expect(
      currentSchoolYear({
        ...y8,
        entryYearGroup: "Y7",
        firstAssessmentYear: "2027-28",
        today: at("2026-10-14"),
      })
    ).toEqual({ kind: "starting", year: 7, academicYear: "2027-28" });
  });

  it("returns null when the year can't be worked out", () => {
    expect(currentSchoolYear({ ...y8, entryYearGroup: "OTHER", today: at("2026-10-14") })).toBeNull();
    expect(currentSchoolYear({ ...y8, firstAssessmentYear: null, today: at("2026-10-14") })).toBeNull();
  });
});

describe("childYearLine", () => {
  const base = { entryYearGroup: "Y8", firstAssessmentYear: "2026-27", school: "TRINITY" };

  it("her wording", () => {
    expect(childYearLine({ ...base, today: at("2026-10-14") })).toBe(
      "Currently in Year 8 at Trinity School"
    );
  });

  it("a future start and an unknown year", () => {
    expect(
      childYearLine({
        ...base,
        entryYearGroup: "Y7",
        firstAssessmentYear: "2027-28",
        school: "WHITGIFT",
        today: at("2026-10-14"),
      })
    ).toBe("Starting Year 7 at Whitgift School in 2027-28");
    expect(childYearLine({ ...base, entryYearGroup: "OTHER", today: at("2026-10-14") })).toBe(
      "At Trinity School"
    );
  });
});
