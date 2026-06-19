import { describe, it, expect } from "vitest";
import { hasPortalAccess } from "../access";

describe("hasPortalAccess (D18)", () => {
  it("grants access with an ACTIVE account", () => {
    expect(
      hasPortalAccess({ accountStatuses: ["ACTIVE"], applicationOutcomes: [] })
    ).toBe(true);
  });

  it("grants access with an ACTIVE account even if another is CLOSED", () => {
    expect(
      hasPortalAccess({
        accountStatuses: ["CLOSED", "ACTIVE"],
        applicationOutcomes: ["AWARDED"],
      })
    ).toBe(true);
  });

  it("REVOKES access when the only account is CLOSED and no in-flight app", () => {
    expect(
      hasPortalAccess({
        accountStatuses: ["CLOSED"],
        applicationOutcomes: ["AWARDED"],
      })
    ).toBe(false);
  });

  it("grants access with an in-flight application (no outcome yet)", () => {
    expect(
      hasPortalAccess({ accountStatuses: [], applicationOutcomes: [null] })
    ).toBe(true);
  });

  it("REVOKES access for a declined-only applicant (terminal, no account)", () => {
    expect(
      hasPortalAccess({
        accountStatuses: [],
        applicationOutcomes: ["DOES_NOT_QUALIFY"],
      })
    ).toBe(false);
  });

  it("REVOKES access for a qualifies-not-awarded-only applicant", () => {
    expect(
      hasPortalAccess({
        accountStatuses: [],
        applicationOutcomes: ["QUALIFIES_NOT_AWARDED"],
      })
    ).toBe(false);
  });

  it("REVOKES access for a brand-new parent with nothing (no account, no app)", () => {
    // (In practice such a parent has an in-flight app; documents the rule.)
    expect(
      hasPortalAccess({ accountStatuses: [], applicationOutcomes: [] })
    ).toBe(false);
  });

  it("F1 manual withdrawal: a CLOSED-only account with no in-flight application revokes access", () => {
    // Setting the account CLOSED (withdrawBursaryAccount) is sufficient to
    // revoke portal access — there is no other account and no application
    // still being assessed.
    expect(
      hasPortalAccess({ accountStatuses: ["CLOSED"], applicationOutcomes: [] })
    ).toBe(false);
  });

  it("re-award restores access (CLOSED → ACTIVE)", () => {
    const beforeReaward = hasPortalAccess({
      accountStatuses: ["CLOSED"],
      applicationOutcomes: ["AWARDED"],
    });
    const afterReaward = hasPortalAccess({
      accountStatuses: ["ACTIVE"],
      applicationOutcomes: ["AWARDED"],
    });
    expect(beforeReaward).toBe(false);
    expect(afterReaward).toBe(true);
  });
});
