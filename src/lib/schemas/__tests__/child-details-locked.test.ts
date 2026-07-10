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
  it("still accepts a legacy draft that carries entryYearGroup", () => {
    const r = childDetailsSchema.safeParse({ ...base, entryYearGroup: "Y7" });
    expect(r.success).toBe(true);
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
