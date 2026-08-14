import { describe, it, expect } from "vitest";
import {
  missingRequiredInviteFields,
  isContactInviteReady,
  contactDisplayName,
  schoolLabel,
  type ContactCore,
} from "../contact-helpers";

const complete: ContactCore = {
  firstName: "Grace",
  lastName: "Adeyemi",
  email: "grace@example.test",
  childName: "Daniel Adeyemi",
  school: "WHITGIFT",
  entryYear: 2026,
  entryYearGroup: "Y7",
};

describe("missingRequiredInviteFields (D1 locked-school invariant)", () => {
  it("returns no missing fields for a complete contact", () => {
    expect(missingRequiredInviteFields(complete)).toEqual([]);
    expect(isContactInviteReady(complete)).toBe(true);
  });

  it("flags a missing school — the locked field must be present at invite", () => {
    const c = { ...complete, school: null };
    expect(missingRequiredInviteFields(c)).toContain("school");
    expect(isContactInviteReady(c)).toBe(false);
  });

  it("flags a missing entry year — locked at invite (D1)", () => {
    const c = { ...complete, entryYear: null };
    expect(missingRequiredInviteFields(c)).toContain("entry year");
    expect(isContactInviteReady(c)).toBe(false);
  });

  // Q1 (Brian, 2026-08-14): the entry year-group is JWF-facing only — the
  // parent can never supply one — so an invite must not go out without it.
  it("flags a missing entry year group — mandatory admin-side (Q1)", () => {
    const c = { ...complete, entryYearGroup: null };
    expect(missingRequiredInviteFields(c)).toContain("entry year group");
    expect(isContactInviteReady(c)).toBe(false);
  });

  it("flags missing surname and child name", () => {
    const c = { ...complete, lastName: "", childName: "" };
    const missing = missingRequiredInviteFields(c);
    expect(missing).toContain("parent surname");
    expect(missing).toContain("child name");
  });

  it("treats whitespace-only required strings as missing", () => {
    const c = { ...complete, lastName: "   ", childName: "  " };
    const missing = missingRequiredInviteFields(c);
    expect(missing).toContain("parent surname");
    expect(missing).toContain("child name");
  });

  it("entry year of 0 is still present (not missing)", () => {
    // entryYear == null is the only "missing" signal; a numeric value counts.
    const c = { ...complete, entryYear: 0 };
    expect(missingRequiredInviteFields(c)).not.toContain("entry year");
  });
});

describe("contactDisplayName", () => {
  it("composes first + last", () => {
    expect(
      contactDisplayName({
        firstName: "Grace",
        lastName: "Adeyemi",
        email: "g@e.test",
      })
    ).toBe("Grace Adeyemi");
  });

  it("falls back to email when no name", () => {
    expect(
      contactDisplayName({ firstName: null, lastName: null, email: "g@e.test" })
    ).toBe("g@e.test");
  });
});

describe("schoolLabel", () => {
  it("maps enum to label", () => {
    expect(schoolLabel("TRINITY")).toBe("Trinity School");
    expect(schoolLabel("WHITGIFT")).toBe("Whitgift School");
    expect(schoolLabel(null)).toBe("—");
  });
});
