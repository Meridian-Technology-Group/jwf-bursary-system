import { describe, it, expect, vi, beforeEach } from "vitest";

const secondaryMock = vi.fn();
const decisionMock = vi.fn();
vi.mock("@/lib/db/queries/secondary-gdpr", () => ({
  getSecondaryContributorForGdpr: () => secondaryMock(),
  decideSecondaryProfileErasure: () => decisionMock(),
}));

const auditMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...(args as [])),
}));

import { closeApplicationCore } from "../close";

function makeTx({
  closedAt = null as Date | null,
  purgedAt = null as Date | null,
  accountStatus = "ACTIVE" as "ACTIVE" | "CLOSED" | null,
  reason = {
    id: "reason-1",
    label: "Relocation",
    purgeOnClose: false,
    isDeprecated: false,
  } as {
    id: string;
    label: string;
    purgeOnClose: boolean;
    isDeprecated: boolean;
  } | null,
} = {}) {
  return {
    application: {
      findUnique: vi.fn(async () => ({
        id: "app-1",
        reference: "WS-202627-0001",
        childName: "Jane Doe",
        closedAt,
        purgedAt,
        leadApplicantId: "lead-1",
        bursaryAccountId: accountStatus ? "acct-1" : null,
        bursaryAccount: accountStatus
          ? { id: "acct-1", status: accountStatus }
          : null,
        documents: [],
        assessment: null,
      })),
      update: vi.fn(),
      count: vi.fn(async () => 0),
    },
    closeReason: { findUnique: vi.fn(async () => reason) },
    bursaryAccount: { update: vi.fn(), count: vi.fn(async () => 0) },
    document: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    applicationSection: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    contact: { updateMany: vi.fn(async () => ({ count: 0 })) },
    invitation: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    applicationContributor: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    profile: {
      findUnique: vi.fn(async () => ({ email: "lead@x.test" })),
      update: vi.fn(),
    },
    auditLog: { updateMany: vi.fn() },
  };
}

const deps = { deleteDocument: vi.fn(async () => {}) };
const input = {
  applicationId: "app-1",
  closeReasonId: "reason-1",
  actorId: "admin-1",
};

beforeEach(() => {
  auditMock.mockClear();
  secondaryMock.mockReset().mockResolvedValue(null);
  decisionMock.mockReset();
});

describe("closeApplicationCore — guards", () => {
  it("rejects a double-close (closedAt is written exactly once)", async () => {
    const tx = makeTx({ closedAt: new Date("2026-01-01") });
    const result = await closeApplicationCore(tx as never, input, deps);
    expect(result).toEqual({
      success: false,
      error: "Application is already closed.",
    });
    expect(tx.application.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("rejects a missing reason (server-side enforcement — Story 4.1)", async () => {
    const tx = makeTx({ reason: null });
    const result = await closeApplicationCore(tx as never, input, deps);
    expect(result.success).toBe(false);
    expect(tx.application.update).not.toHaveBeenCalled();
  });

  it("rejects a deactivated reason", async () => {
    const tx = makeTx({
      reason: {
        id: "reason-1",
        label: "Old reason",
        purgeOnClose: false,
        isDeprecated: true,
      },
    });
    const result = await closeApplicationCore(tx as never, input, deps);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("deactivated");
  });
});

describe("closeApplicationCore — non-purge close (Story 2.2, toggle off)", () => {
  it("closes application + live account, retains all data, audits once", async () => {
    const tx = makeTx();
    const result = await closeApplicationCore(tx as never, input, deps);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.purgeRan).toBe(false);
    expect(result.accountClosed).toBe(true);
    expect(result.authUsersToDelete).toEqual([]);

    // Close fields stamped once.
    expect(tx.application.update).toHaveBeenCalledTimes(1);
    expect(tx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({
          closedById: "admin-1",
          closeReasonId: "reason-1",
        }),
      })
    );
    // Live account wound down with the close (subsumes withdraw).
    expect(tx.bursaryAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acct-1" },
        data: expect.objectContaining({ status: "CLOSED" }),
      })
    );
    // NO purge side effects.
    expect(tx.document.deleteMany).not.toHaveBeenCalled();
    expect(tx.applicationSection.deleteMany).not.toHaveBeenCalled();
    expect(tx.profile.update).not.toHaveBeenCalled();
    // Exactly one audit row: APPLICATION_CLOSED.
    expect(auditMock).toHaveBeenCalledTimes(1);
    const arg = auditMock.mock.calls[0]?.[1] as unknown as {
      action: string;
      metadata: Record<string, unknown>;
    };
    expect(arg.action).toBe("APPLICATION_CLOSED");
    expect(arg.metadata.purgeRan).toBe(false);
    expect(arg.metadata.accountClosed).toBe(true);
  });

  it("leaves an already-CLOSED account untouched (idempotent, closedAt immutable)", async () => {
    const tx = makeTx({ accountStatus: "CLOSED" });
    const result = await closeApplicationCore(tx as never, input, deps);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.accountClosed).toBe(false);
    expect(tx.bursaryAccount.update).not.toHaveBeenCalled();
  });
});

describe("closeApplicationCore — purge close (Story 2.2, toggle on)", () => {
  const purgeReason = {
    id: "reason-2",
    label: "Declined by the school",
    purgeOnClose: true,
    isDeprecated: false,
  };

  it("runs the purge, stamps purgedAt, audits CLOSED + PURGED", async () => {
    const tx = makeTx({ reason: purgeReason });
    const result = await closeApplicationCore(
      tx as never,
      { ...input, closeReasonId: "reason-2" },
      deps
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.purgeRan).toBe(true);

    // Purge side effects ran (sections/documents deleted, child scrubbed).
    expect(tx.applicationSection.deleteMany).toHaveBeenCalled();
    expect(tx.document.deleteMany).toHaveBeenCalled();

    // purgedAt stamped (second application.update call).
    const updates = (tx.application.update as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(
      updates.some(
        (c) => (c[0] as { data: Record<string, unknown> }).data.purgedAt
      )
    ).toBe(true);

    // Both audit rows, purge first then close.
    const actions = auditMock.mock.calls.map(
      (c) => (c[1] as unknown as { action: string }).action
    );
    expect(actions).toEqual(["APPLICATION_PURGED", "APPLICATION_CLOSED"]);
  });

  it("skips the purge when purgedAt is already set (idempotency gate)", async () => {
    const tx = makeTx({
      reason: purgeReason,
      purgedAt: new Date("2026-01-01"),
    });
    // An already-purged application can still be in a not-closed state only in
    // theory; the gate must hold regardless.
    const result = await closeApplicationCore(
      tx as never,
      { ...input, closeReasonId: "reason-2" },
      deps
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.purgeRan).toBe(false);
    expect(tx.applicationSection.deleteMany).not.toHaveBeenCalled();
  });
});
