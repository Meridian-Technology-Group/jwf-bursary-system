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
