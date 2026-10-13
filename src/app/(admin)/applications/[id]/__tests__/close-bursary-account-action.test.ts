import { describe, it, expect, vi, beforeEach } from "vitest";

// Epic 18b's admin-page account close had no test (Epic 21 T4 plan). It sits
// beside "End after this year" / "Add a year", which can re-open what it closes.

const requireRoleMock = vi.fn(async (..._args: unknown[]) => ({
  id: "admin-1",
  role: "ADMIN",
  email: "admin@example.test",
  firstName: "Al",
  lastName: "Admin",
}));
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return { ...actual, requireRole: (...args: unknown[]) => requireRoleMock(...args) };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const auditMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...args),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { closeBursaryAccountAction } from "../bursary-account-actions";

function makeFakeTx({
  status = "ACTIVE",
  reason = { id: "reason-1", label: "Leaving the school", isDeprecated: false } as
    | { id: string; label: string; isDeprecated: boolean }
    | null,
} = {}) {
  return {
    bursaryAccount: {
      findUnique: vi.fn(async () => ({ id: "acc-1", status, childName: "Child" })),
      update: vi.fn(async () => ({})),
    },
    closeReason: { findUnique: vi.fn(async () => reason) },
  };
}

const input = { bursaryAccountId: "acc-1", closeReasonId: "reason-1", applicationId: "app-1" };

describe("closeBursaryAccountAction (Epic 18b)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes an ACTIVE account with its reason and audits it (ADMIN only)", async () => {
    fakeTx = makeFakeTx();
    const res = await closeBursaryAccountAction(input);

    expect(res).toEqual({ success: true });
    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    const update = (fakeTx.bursaryAccount.update.mock.calls as unknown as unknown[][])[0][0] as {
      data: { status: string; closedAt: Date; closeReasonId: string };
    };
    expect(update.data.status).toBe("CLOSED");
    expect(update.data.closeReasonId).toBe("reason-1");
    expect(update.data.closedAt).toBeInstanceOf(Date);
    expect((auditMock.mock.calls[0]?.[1] as { action: string }).action).toBe("BURSARY_ACCOUNT_CLOSED");
  });

  it("refuses an account that is already closed (closedAt is never rewritten)", async () => {
    fakeTx = makeFakeTx({ status: "CLOSED" });
    const res = await closeBursaryAccountAction(input);
    expect(res).toEqual({ success: false, error: "This account is already closed." });
    expect(fakeTx.bursaryAccount.update).not.toHaveBeenCalled();
  });

  it("refuses a missing or deprecated close reason", async () => {
    fakeTx = makeFakeTx({ reason: null });
    expect((await closeBursaryAccountAction(input)).success).toBe(false);
    fakeTx = makeFakeTx({ reason: { id: "reason-1", label: "Old", isDeprecated: true } });
    expect((await closeBursaryAccountAction(input)).success).toBe(false);
    expect(fakeTx.bursaryAccount.update).not.toHaveBeenCalled();
  });
});
