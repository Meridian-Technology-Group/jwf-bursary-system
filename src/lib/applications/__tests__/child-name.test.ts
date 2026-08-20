import { describe, it, expect } from "vitest";
import { composeChildName, resolveChildNameParts } from "../child-name";

describe("resolveChildNameParts", () => {
  it("prefers the split fields when present", () => {
    expect(
      resolveChildNameParts({
        childName: "Wolfgang Skrzynski",
        childFirstName: "Anna Maria",
        childLastName: "de la Cruz",
      })
    ).toEqual({ firstName: "Anna Maria", lastName: "de la Cruz" });
  });

  it("splits a legacy single string on the last token", () => {
    expect(
      resolveChildNameParts({ childName: "Anna Maria de la Cruz" })
    ).toEqual({ firstName: "Anna Maria de la", lastName: "Cruz" });
  });

  it("a single-token legacy name is a first name with no surname", () => {
    expect(resolveChildNameParts({ childName: "Skrzynski" })).toEqual({
      firstName: "Skrzynski",
      lastName: "",
    });
  });

  it("handles null/empty gracefully", () => {
    expect(resolveChildNameParts({ childName: null })).toEqual({
      firstName: "",
      lastName: "",
    });
    expect(resolveChildNameParts({ childName: "  " })).toEqual({
      firstName: "",
      lastName: "",
    });
  });

  it("uses a lone split surname even when first name is missing", () => {
    expect(
      resolveChildNameParts({ childName: "Legacy Name", childLastName: "Amoah" })
    ).toEqual({ firstName: "", lastName: "Amoah" });
  });
});

describe("composeChildName", () => {
  it("joins and trims", () => {
    expect(composeChildName(" Levi ", " Amoah ")).toBe("Levi Amoah");
    expect(composeChildName(null, "Amoah")).toBe("Amoah");
    expect(composeChildName("", "")).toBe("");
  });
});
