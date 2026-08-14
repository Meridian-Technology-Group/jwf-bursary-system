import { describe, it, expect } from "vitest";
import { childDetailsSchema } from "@/lib/schemas/child-details";

const base = {
  school: "WHITGIFT" as const,
  childTitle: "MASTER",
  childFirstName: "Alex",
  childSurname: "Smith",
  gender: "Male",
  dateOfBirth: "2014-05-01",
  placeOfBirthCity: "London",
  placeOfBirth: "United Kingdom",
  sameAddressAsParent1: true,
  currentSchool: "St Mary's Primary",
  currentSchoolStartDate: "2019-09-01",
};

describe("childDetailsSchema — entry-year now admin-side (Epic 02 PR-6, D1)", () => {
  it("validates WITHOUT an entryYearGroup (picker removed from the parent form)", () => {
    const r = childDetailsSchema.safeParse(base);
    expect(r.success).toBe(true);
  });
  // Q1 (Brian, 2026-08-14): the entry year-group is JWF-facing only. The
  // applicant schema must neither declare nor validate it, and a legacy draft
  // that still carries one must have it STRIPPED rather than parsed back out —
  // otherwise the blob could travel onward and shadow the admin-set column.
  it("strips entryYearGroup from a legacy draft instead of accepting it", () => {
    const r = childDetailsSchema.safeParse({ ...base, entryYearGroup: "Y7" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty("entryYearGroup");
    }
  });
  it("does not reject an out-of-enum entry year group — it is simply not a field", () => {
    // Proof there is no applicant-side VALIDATION of entry year either: a value
    // that the old `entryYearGroupSchema` would have rejected parses fine now.
    const r = childDetailsSchema.safeParse({ ...base, entryYearGroup: "Y99" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).not.toHaveProperty("entryYearGroup");
  });
  it("still requires the school (locked value pinned into form state)", () => {
    const { school, ...withoutSchool } = base;
    void school;
    const r = childDetailsSchema.safeParse(withoutSchool);
    expect(r.success).toBe(false);
  });
  it("requires a first name and surname", () => {
    const { childFirstName, ...noFirst } = base;
    void childFirstName;
    expect(childDetailsSchema.safeParse(noFirst).success).toBe(false);
    const { childSurname, ...noSurname } = base;
    void childSurname;
    expect(childDetailsSchema.safeParse(noSurname).success).toBe(false);
  });
  it("requires the town/city of birth as well as the country", () => {
    const { placeOfBirthCity, ...noCity } = base;
    void placeOfBirthCity;
    expect(childDetailsSchema.safeParse(noCity).success).toBe(false);
  });
  it("derives childFullName from first name + surname on write", () => {
    const r = childDetailsSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.childFullName).toBe("Alex Smith");
  });
});
