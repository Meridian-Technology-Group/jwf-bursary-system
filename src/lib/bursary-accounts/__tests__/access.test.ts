import { describe, it, expect, vi, beforeEach } from "vitest";

// access.ts imports `@/lib/db/prisma` (Prisma client construction +
// withAdminContext). Stub the module so the loader can be exercised without a
// real DB. `withAdminContext(fn)` simply invokes `fn` with a fake service-role
// tx supplied per-test — this lets us prove that outcomes are sourced from the
// service-role hop (where the assessment is visible), NOT from the applicant's
// own (RLS-masked) tx.
const adminTxRef: { current: unknown } = { current: null };
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn(adminTxRef.current)
  ),
}));

import { hasPortalAccess, loadPortalAccessState } from "../access";
import type { Tx } from "@/lib/db/prisma";

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

// ─── loadPortalAccessState — the DATA LOADER (regression for the RLS-masking bug)
//
// The bug: `assessments_select` is staff-only, so when the loader read the
// application outcome under the APPLICANT's RLS context the nested assessment
// resolved to null → every outcome looked null → hasInFlightApplication()
// returned true → a withdrawn (CLOSED) family with a TERMINAL (AWARDED) outcome
// kept portal access. The fix reads outcomes via withAdminContext (service-role),
// where the assessment row is visible. These tests prove the loader feeds the
// predicate the REAL outcome from the service-role hop, not the masked one.
describe("loadPortalAccessState (RLS-masking regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminTxRef.current = null;
  });

  // Fake applicant tx: accounts ARE applicant-readable, so this returns them.
  // Crucially, this tx is NEVER used to read outcomes — if the loader ever read
  // application outcomes here it would (like real RLS) see a masked null.
  function makeApplicantTx(accountStatuses: string[]): Tx {
    return {
      bursaryAccount: {
        findMany: vi.fn(async () =>
          accountStatuses.map((status) => ({ status }))
        ),
      },
      // A poisoned application.findMany on the applicant tx: if the loader
      // mistakenly reads outcomes here, it gets the RLS-masked null (the bug),
      // which the assertions below would catch.
      application: {
        findMany: vi.fn(async () => [{ assessment: null }]),
      },
    } as unknown as Tx;
  }

  // Fake service-role tx: the assessment IS visible here, so the real outcome
  // comes back. This is the context the fix must use for outcomes.
  function makeServiceRoleTx(outcomes: (string | null)[]): unknown {
    return {
      application: {
        findMany: vi.fn(async () =>
          outcomes.map((outcome) => ({
            assessment: outcome === null ? null : { outcome },
          }))
        ),
      },
    };
  }

  it("REVOKES access for a CLOSED-only account whose application is AWARDED (the bug scenario)", async () => {
    // parent2 in the E2E: 1 CLOSED account + 1 AWARDED application. The terminal
    // outcome is only visible via the service-role hop; under the applicant tx
    // it would be masked to null and wrongly grant access.
    adminTxRef.current = makeServiceRoleTx(["AWARDED"]);
    const { hasAccess, input } = await loadPortalAccessState(
      makeApplicantTx(["CLOSED"]),
      "parent-2"
    );
    expect(input.applicationOutcomes).toEqual(["AWARDED"]);
    expect(hasAccess).toBe(false);
  });

  it("does NOT read outcomes from the applicant (RLS-masked) tx", async () => {
    adminTxRef.current = makeServiceRoleTx(["AWARDED"]);
    const applicantTx = makeApplicantTx(["CLOSED"]);
    await loadPortalAccessState(applicantTx, "parent-2");
    // accounts ARE read on the applicant tx…
    expect(
      (applicantTx as unknown as { bursaryAccount: { findMany: ReturnType<typeof vi.fn> } })
        .bursaryAccount.findMany
    ).toHaveBeenCalledTimes(1);
    // …but outcomes are NOT (they would be masked to null there).
    expect(
      (applicantTx as unknown as { application: { findMany: ReturnType<typeof vi.fn> } })
        .application.findMany
    ).not.toHaveBeenCalled();
  });

  it("still GRANTS access for a genuinely in-flight application (no outcome yet)", async () => {
    adminTxRef.current = makeServiceRoleTx([null]);
    const { hasAccess } = await loadPortalAccessState(
      makeApplicantTx([]),
      "parent-3"
    );
    expect(hasAccess).toBe(true);
  });

  it("GRANTS access when an ACTIVE account exists regardless of outcome", async () => {
    adminTxRef.current = makeServiceRoleTx(["AWARDED"]);
    const { hasAccess } = await loadPortalAccessState(
      makeApplicantTx(["ACTIVE"]),
      "parent-4"
    );
    expect(hasAccess).toBe(true);
  });
});
