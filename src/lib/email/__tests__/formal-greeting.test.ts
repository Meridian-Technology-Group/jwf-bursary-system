import { describe, expect, it } from "vitest";
import { formalGreeting, parent1ContactOf } from "../formal-greeting";

describe("formalGreeting (JWF style: title + surname)", () => {
  it("title and surname, from a code or a label", () => {
    expect(formalGreeting({ title: "MRS", firstName: "Ada", lastName: "Surname" })).toBe("Mrs Surname");
    expect(formalGreeting({ title: "Dr", firstName: "Ada", lastName: "Surname" })).toBe("Dr Surname");
  });
  it("no title, or Other, falls back to the full name; nothing at all → Parent", () => {
    expect(formalGreeting({ title: "OTHER", firstName: "Ada", lastName: "Surname" })).toBe("Ada Surname");
    expect(formalGreeting({ firstName: "Ada", lastName: "Surname" })).toBe("Ada Surname");
    expect(formalGreeting({})).toBe("Parent");
  });
});

describe("parent1ContactOf", () => {
  it("reads Parent 1's block from a PARENT_DETAILS section", () => {
    expect(parent1ContactOf({ parent1Contact: { title: "MS", firstName: "A", lastName: "B", email: "x" } })).toEqual({ title: "MS", firstName: "A", lastName: "B" });
    expect(parent1ContactOf({})).toBe(null);
    expect(parent1ContactOf(null)).toBe(null);
  });
});
