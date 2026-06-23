import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks ───────────────────────────────────────────────────────────

const requireRoleMock = vi.fn(async () => ({
  id: "assessor-1",
  role: "ASSESSOR",
  email: "assessor@example.test",
  firstName: "As",
  lastName: "Sessor",
}));
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...(args as [])),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...(args as [])),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
}));

import { withdrawBursaryAccount } from "../bursary-account-actions";

function makeFakeTx(overrides: Record<string, unknown> = {}) {
  return {
    bursaryAccount: {
      findUnique: vi.fn(async () => ({
        id: "acc-1",
        status: "ACTIVE",
        reference: "BA-1",
      })),
      update: vi.fn(async () => ({})),
    },
    ...overrides,
  };
}

const baseInput = {
  accountId: "acc-1",
  applicationId: "app-1",
  reason: "Family no longer requires support.",
};

describe("withdrawBursaryAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({
      id: "assessor-1",
      role: "ASSESSOR",
      email: "assessor@example.test",
      firstName: "As",
      lastName: "Sessor",
    });
  });

  it("closes an ACTIVE account: sets CLOSED + closedAt and audits with reason", async () => {
    fakeTx = makeFakeTx();
    const res = await withdrawBursaryAccount(baseInput);

    expect(res).toEqual({ success: true, alreadyClosed: false });
    expect(fakeTx.bursaryAccount.update).toHaveBeenCalledTimes(1);
    const updateArg = (fakeTx.bursaryAccount.update.mock.calls[0] as unknown[])[0] as {
      where: { id: string };
      data: { status: string; closedAt: Date };
    };
    expect(updateArg.where).toEqual({ id: "acc-1" });
    expect(updateArg.data.status).toBe("CLOSED");
    expect(updateArg.data.closedAt).toBeInstanceOf(Date);

    expect(auditMock).toHaveBeenCalledTimes(1);
    const auditArg = (auditMock.mock.calls[0] as unknown[])[1] as {
      action: string;
      metadata: { accountId: string; reason: string };
    };
    expect(auditArg.action).toBe("BURSARY_ACCOUNT_WITHDRAWN");
    expect(auditArg.metadata).toEqual({
      accountId: "acc-1",
      reason: "Family no longer requires support.",
    });
  });

  it("is idempotent: already-CLOSED account is a no-op (no second closedAt write, no audit)", async () => {
    fakeTx = makeFakeTx({
      bursaryAccount: {
        findUnique: vi.fn(async () => ({
          id: "acc-1",
          status: "CLOSED",
          reference: "BA-1",
        })),
        update: vi.fn(async () => ({})),
      },
    });
    const res = await withdrawBursaryAccount(baseInput);

    expect(res).toEqual({ success: true, alreadyClosed: true });
    expect(fakeTx.bursaryAccount.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("allows withdrawal in ANY state — no schedule/document/lifecycle gate", async () => {
    // The action never reads schedule entries or documents; an ACTIVE account
    // with an in-progress schedule still closes on demand.
    fakeTx = makeFakeTx();
    const res = await withdrawBursaryAccount(baseInput);
    expect(res.success).toBe(true);
    expect(fakeTx.bursaryAccount.findUnique).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      select: { id: true, status: true, reference: true },
    });
  });

  it("rejects an empty reason without touching the account", async () => {
    fakeTx = makeFakeTx();
    const res = await withdrawBursaryAccount({ ...baseInput, reason: "   " });
    expect(res.success).toBe(false);
    expect(fakeTx.bursaryAccount.findUnique).not.toHaveBeenCalled();
    expect(fakeTx.bursaryAccount.update).not.toHaveBeenCalled();
  });

  it("is role-gated: a non-staff caller is rejected before any DB write", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Forbidden"));
    fakeTx = makeFakeTx();
    const res = await withdrawBursaryAccount(baseInput);
    expect(res.success).toBe(false);
    expect(fakeTx.bursaryAccount.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("fails cleanly when the account does not exist", async () => {
    fakeTx = makeFakeTx({
      bursaryAccount: {
        findUnique: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
    });
    const res = await withdrawBursaryAccount(baseInput);
    expect(res.success).toBe(false);
    expect(fakeTx.bursaryAccount.update).not.toHaveBeenCalled();
  });
});
