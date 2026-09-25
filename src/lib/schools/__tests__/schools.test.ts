import { describe, expect, it } from "vitest";
import {
  ALL_SCHOOLS,
  finalEligibleSchoolYear,
  isSchool,
  schoolName,
  schoolVatRate,
} from "..";

describe("schools (single source of truth for per-school behaviour)", () => {
  it("names each school, long and short", () => {
    expect(schoolName("TRINITY")).toBe("Trinity School");
    expect(schoolName("WHITGIFT", "short")).toBe("Whitgift");
  });

  it("names nothing for an absent or unknown school, so callers choose their fallback", () => {
    expect(schoolName(null)).toBe("");
    expect(schoolName(undefined, "short")).toBe("");
    expect(schoolName("ELSEWHERE")).toBe("");
  });

  it("Trinity and Whitgift run to Year 13 with 20% VAT", () => {
    for (const s of ["TRINITY", "WHITGIFT"] as const) {
      expect(finalEligibleSchoolYear(s)).toBe(13);
      expect(schoolVatRate(s)).toBe(20);
    }
  });

  it("recognises exactly the listed schools", () => {
    for (const s of ALL_SCHOOLS) expect(isSchool(s)).toBe(true);
    expect(isSchool("ELSEWHERE")).toBe(false);
    expect(isSchool(null)).toBe(false);
  });
});
