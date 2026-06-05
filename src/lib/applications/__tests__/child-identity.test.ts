import { describe, it, expect } from "vitest";
import {
  childIdentityKey,
  childrenCollide,
  normaliseChildDob,
} from "../child-identity";

describe("normaliseChildDob (NULL-DOB handling, D12)", () => {
  it("maps NULL/undefined to a single sentinel so unknown DOBs collide", () => {
    expect(normaliseChildDob(null)).toBe(normaliseChildDob(undefined));
  });

  it("normalises a Date to YYYY-MM-DD", () => {
    expect(normaliseChildDob(new Date("2015-06-01T00:00:00.000Z"))).toBe(
      "2015-06-01"
    );
  });

  it("normalises an ISO / YYYY-MM-DD string to YYYY-MM-DD", () => {
    expect(normaliseChildDob("2015-06-01")).toBe("2015-06-01");
    expect(normaliseChildDob("2015-06-01T12:34:56Z")).toBe("2015-06-01");
  });
});

describe("childrenCollide — twins vs duplicates (D12)", () => {
  it("twins (same name, DIFFERENT DOB) do NOT collide", () => {
    expect(
      childrenCollide(
        { childName: "Jordan Chen", childDob: "2015-06-01" },
        { childName: "Jordan Chen", childDob: "2017-02-18" }
      )
    ).toBe(false);
  });

  it("the SAME child (same name + same DOB) collides — one account per child", () => {
    expect(
      childrenCollide(
        { childName: "Jordan Chen", childDob: "2015-06-01" },
        { childName: "Jordan Chen", childDob: new Date("2015-06-01") }
      )
    ).toBe(true);
  });

  it("two unknown-DOB (NULL) same-name children collide (NULL coalesced)", () => {
    // This is the NULL-distinctness trap the partial unique index closes:
    // without coalescing, Postgres would treat these as distinct.
    expect(
      childrenCollide(
        { childName: "Sam Okafor", childDob: null },
        { childName: "Sam Okafor", childDob: null }
      )
    ).toBe(true);
  });

  it("a known-DOB and an unknown-DOB same-name child do NOT collide", () => {
    expect(
      childrenCollide(
        { childName: "Sam Okafor", childDob: "2014-01-01" },
        { childName: "Sam Okafor", childDob: null }
      )
    ).toBe(false);
  });

  it("different names never collide regardless of DOB", () => {
    expect(
      childrenCollide(
        { childName: "Ada Okafor", childDob: "2015-06-01" },
        { childName: "Chidi Okafor", childDob: "2015-06-01" }
      )
    ).toBe(false);
  });

  it("name comparison is case- and whitespace-insensitive", () => {
    expect(
      childIdentityKey({ childName: "  Jordan Chen ", childDob: "2015-06-01" })
    ).toBe(childIdentityKey({ childName: "jordan chen", childDob: "2015-06-01" }));
  });
});
