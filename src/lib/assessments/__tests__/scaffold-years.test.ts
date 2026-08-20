import { describe, expect, it } from "vitest";
import { scaffoldAcademicYears } from "../admin-tab";

describe("scaffoldAcademicYears (Epic 15 M7 / CI-13)", () => {
  it("spans from the round year across the given horizon", () => {
    expect(scaffoldAcademicYears("2026/27", 3)).toEqual([
      "2026/27",
      "2027/28",
      "2028/29",
    ]);
  });

  it("defaults to the 8-year (Year 6 entry) horizon when unsized", () => {
    const years = scaffoldAcademicYears("2026/27", null);
    expect(years).toHaveLength(8);
    expect(years[0]).toBe("2026/27");
    expect(years[7]).toBe("2033/34");
  });

  it("clamps the horizon to 1..8", () => {
    expect(scaffoldAcademicYears("2026/27", 0)).toHaveLength(1);
    expect(scaffoldAcademicYears("2026/27", 25)).toHaveLength(8);
  });

  it("century rollover labels correctly", () => {
    expect(scaffoldAcademicYears("2098/99", 3)).toEqual([
      "2098/99",
      "2099/00",
      "2100/01",
    ]);
  });

  it("an unparseable round year yields no scaffold", () => {
    expect(scaffoldAcademicYears("nonsense", 4)).toEqual([]);
  });
});
