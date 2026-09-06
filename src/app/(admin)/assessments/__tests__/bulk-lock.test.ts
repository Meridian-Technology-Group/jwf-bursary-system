import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Epic 18b — the mid-September bulk lock. Pins the two rules the dialog
 * promises: the fund carries forward from the account's most recent previous
 * award (fallback JWF), and a row the single-lock core refuses is skipped and
 * reported, never forced.
 */

const requireRoleMock = vi.fn(async () => ({ id: "admin-1", role: "ADMIN" }));
vi.mock("@/lib/auth/roles", () => ({
  requireRole: () => requireRoleMock(),
  Role: { ADMIN: "ADMIN", ASSESSOR: "ASSESSOR", VIEWER: "VIEWER" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type LockResult = { success: true } | { success: false; error: string };
const lockMock = vi.fn(
  async (..._args: unknown[]): Promise<LockResult> => ({ success: true })
);
vi.mock("@/lib/applications/post-assessment-core", () => ({
  setPostAssessmentFinalState: (...args: unknown[]) => lockMock(...args),
}));

let fakeTx: {
  assessment: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { bulkLockRolledOverAction } from "../actions";

function target(applicationId: string, reference: string, bursaryAccountId: string | null) {
  return {
    applicationId,
    application: { reference, roundId: "round-2027", bursaryAccountId },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bulkLockRolledOverAction", () => {
  it("locks every stored rolling-over assessment, carrying each account's previous fund forward", async () => {
    fakeTx = {
      assessment: {
        findMany: vi.fn(async () => [
          target("app-1", "REF-1", "acct-1"),
          target("app-2", "REF-2", "acct-2"),
        ]),
        // acct-1's last award was TBF; acct-2 has no prior fund on record.
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ awardFundType: "TBF" })
          .mockResolvedValueOnce(null),
      },
    };

    const res = await bulkLockRolledOverAction();

    expect(res).toEqual({ success: true, result: { locked: 2, skipped: [] } });
    expect(lockMock).toHaveBeenCalledWith("app-1", "ROLLED_OVER", { awardFundType: "TBF" });
    expect(lockMock).toHaveBeenCalledWith("app-2", "ROLLED_OVER", { awardFundType: "JWF" });
  });

  it("skips and reports a row the core refuses, locking the rest", async () => {
    fakeTx = {
      assessment: {
        findMany: vi.fn(async () => [
          target("app-1", "REF-1", null),
          target("app-2", "REF-2", null),
        ]),
        findFirst: vi.fn(async () => null),
      },
    };
    lockMock
      .mockResolvedValueOnce({
        success: false,
        error: "The payable fees on this recommendation have not been confirmed…",
      })
      .mockResolvedValueOnce({ success: true });

    const res = await bulkLockRolledOverAction();

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.result.locked).toBe(1);
      expect(res.result.skipped).toEqual([
        {
          reference: "REF-1",
          error: "The payable fees on this recommendation have not been confirmed…",
        },
      ]);
    }
  });

  it("reports when nothing is waiting to lock", async () => {
    fakeTx = {
      assessment: { findMany: vi.fn(async () => []), findFirst: vi.fn() },
    };
    const res = await bulkLockRolledOverAction();
    expect(res).toEqual({
      success: false,
      error: "No rolling-over assessments are stored as complete.",
    });
    expect(lockMock).not.toHaveBeenCalled();
  });
});
