import { describe, expect, it } from "vitest";
import {
  academicYearLabel,
  academicYearLabelFor,
  academicYearStartDate,
  academicYearStartFor,
} from "../academic-year";

describe("academic-year helpers (Epic 15 M2 / CH-17)", () => {
  it("start date is 1 September UTC of the start year", () => {
    expect(academicYearStartDate(2026).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z"
    );
  });

  it("September onwards belongs to the year that just started", () => {
    expect(academicYearStartFor(new Date("2026-09-01T00:00:00.000Z"))).toBe(2026);
    expect(academicYearStartFor(new Date("2026-12-31T00:00:00.000Z"))).toBe(2026);
  });

  it("January to August belong to the previous start year", () => {
    expect(academicYearStartFor(new Date("2026-08-20T00:00:00.000Z"))).toBe(2025);
    expect(academicYearStartFor(new Date("2027-01-15T00:00:00.000Z"))).toBe(2026);
  });

  it("labels read the Foundation's way", () => {
    expect(academicYearLabel(2025)).toBe("2025-26");
    expect(academicYearLabel(2026)).toBe("2026-27");
    expect(academicYearLabel(2099)).toBe("2099-00");
    expect(academicYearLabelFor(new Date("2026-05-29T00:00:00.000Z"))).toBe(
      "2025-26"
    );
  });

  it("round-trips: a stored 1-Sep date labels as its own year", () => {
    expect(academicYearLabelFor(academicYearStartDate(2026))).toBe("2026-27");
  });
});

// ── CH-26 (Charlotte, 2026-08-22): entry years read as the full academic year ─
import {
  entryAcademicYearLabel,
  entryAcademicYearLabelOrNull,
  entryAcademicYearOptions,
} from "../academic-year";

describe("entry academic year (CH-26)", () => {
  it("labels a start year with both full years", () => {
    // Charlotte's example verbatim: a 2027 entry is the 2027/2028 academic year.
    expect(entryAcademicYearLabel(2027)).toBe("2027/2028");
    expect(entryAcademicYearLabel(2026)).toBe("2026/2027");
    expect(entryAcademicYearLabel(2099)).toBe("2099/2100");
  });

  it("tolerates the loose shapes the admin tables carry", () => {
    expect(entryAcademicYearLabelOrNull(2027)).toBe("2027/2028");
    expect(entryAcademicYearLabelOrNull("2027")).toBe("2027/2028");
  });

  it("returns null rather than a bogus year when there is nothing to show", () => {
    expect(entryAcademicYearLabelOrNull(null)).toBeNull();
    expect(entryAcademicYearLabelOrNull(undefined)).toBeNull();
    expect(entryAcademicYearLabelOrNull("")).toBeNull();
    expect(entryAcademicYearLabelOrNull("not a year")).toBeNull();
  });

  it("offers a rolling window from one year back through six ahead", () => {
    const options = entryAcademicYearOptions(
      new Date("2026-08-22T00:00:00.000Z")
    );
    expect(options).toHaveLength(8);
    expect(options[0]).toEqual({ value: "2025", label: "2025/2026" });
    expect(options[1]).toEqual({ value: "2026", label: "2026/2027" });
    expect(options.at(-1)).toEqual({ value: "2032", label: "2032/2033" });
  });

  it("submits the start year the entry_year column holds", () => {
    // The label is display only — every option's value stays the 4-digit start
    // year, so the stored Int is unchanged by CH-26.
    for (const opt of entryAcademicYearOptions(new Date("2026-08-22"))) {
      expect(opt.value).toMatch(/^\d{4}$/);
      expect(opt.label).toBe(entryAcademicYearLabel(Number(opt.value)));
    }
  });
});
