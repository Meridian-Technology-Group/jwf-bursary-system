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

function prior(bursaryAccountId: string, roundId: string, awardFundType: string) {
  return { awardFundType, application: { bursaryAccountId, roundId } };
}

/** The plan's two reads: the targets, then every prior award (newest first). */
function planTx(targets: unknown[], priors: unknown[] = []) {
  return {
    assessment: {
      findMany: vi.fn(async (args: { where: { status?: string } }) =>
        args.where.status === "COMPLETED" ? targets : priors
      ),
      findFirst: vi.fn(async () => null),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bulkLockRolledOverAction", () => {
  it("locks every stored rolling-over assessment, carrying each account's previous fund forward", async () => {
    // acct-1's last award was TBF; acct-2 has no prior fund on record.
    fakeTx = planTx(
      [target("app-1", "REF-1", "acct-1"), target("app-2", "REF-2", "acct-2")],
      [prior("acct-1", "round-2026", "TBF")]
    );

    const res = await bulkLockRolledOverAction();

    expect(res).toEqual({ success: true, result: { locked: 2, skipped: [] } });
    expect(lockMock).toHaveBeenCalledWith("app-1", "ROLLED_OVER", { awardFundType: "TBF" });
    expect(lockMock).toHaveBeenCalledWith("app-2", "ROLLED_OVER", { awardFundType: "JWF" });
  });

  it("plans with two queries however many accounts: the targets, then every prior award", async () => {
    fakeTx = planTx([
      target("app-1", "REF-1", "acct-1"),
      target("app-2", "REF-2", "acct-2"),
      target("app-3", "REF-3", "acct-1"),
      target("app-4", "REF-4", null),
    ]);

    await bulkLockRolledOverAction();

    expect(fakeTx.assessment.findFirst).not.toHaveBeenCalled();
    expect(fakeTx.assessment.findMany).toHaveBeenCalledTimes(2);
    expect(fakeTx.assessment.findMany.mock.calls[1][0]).toEqual({
      // The per-account findFirst's filter and order; its round exclusion is
      // applied per target in memory.
      where: {
        awardFundType: { not: null },
        application: { bursaryAccountId: { in: ["acct-1", "acct-2"] } },
      },
      orderBy: { completedAt: "desc" },
      select: {
        awardFundType: true,
        application: { select: { bursaryAccountId: true, roundId: true } },
      },
    });
  });

  it("each target takes its account's newest award from a DIFFERENT round, as findFirst did", async () => {
    fakeTx = planTx(
      [
        target("app-1", "REF-1", "acct-1"), // round-2027
        {
          applicationId: "app-9",
          application: { reference: "REF-9", roundId: "round-2026", bursaryAccountId: "acct-1" },
        },
        target("app-2", "REF-2", "acct-2"),
      ],
      // Newest first (completedAt desc).
      [
        prior("acct-1", "round-2027", "WFA"),
        prior("acct-2", "round-2025", "JWF"),
        prior("acct-1", "round-2026", "TBF"),
        prior("acct-1", "round-2025", "JWF"),
      ]
    );

    await bulkLockRolledOverAction();

    // The 2027 target skips its own round's WFA and takes 2026's TBF.
    expect(lockMock).toHaveBeenCalledWith("app-1", "ROLLED_OVER", { awardFundType: "TBF" });
    // The 2026 target's newest other-round award is 2027's WFA.
    expect(lockMock).toHaveBeenCalledWith("app-9", "ROLLED_OVER", { awardFundType: "WFA" });
    expect(lockMock).toHaveBeenCalledWith("app-2", "ROLLED_OVER", { awardFundType: "JWF" });
  });

  it("skips and reports a row the core refuses, locking the rest", async () => {
    fakeTx = planTx([target("app-1", "REF-1", null), target("app-2", "REF-2", null)]);
    lockMock
      .mockResolvedValueOnce({
        success: false,
        error: "The payable fees on this recommendation have not been confirmed…",
      })
      .mockResolvedValueOnce({ success: true });

    const res = await bulkLockRolledOverAction();

    expect(res.success).toBe(true);
    // No account on either row, so no prior-award query at all.
    expect(fakeTx.assessment.findMany).toHaveBeenCalledTimes(1);
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

  it("never plans a closed application (audit 20 Nov 2026)", async () => {
    fakeTx = {
      assessment: { findMany: vi.fn(async () => []), findFirst: vi.fn() },
    };
    await bulkLockRolledOverAction();
    const where = (fakeTx.assessment.findMany.mock.calls[0] as unknown as [
      { where: { application: Record<string, unknown> } },
    ])[0].where;
    expect(where.application).toMatchObject({ closedAt: null });
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
