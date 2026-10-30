import { describe, it, expect, vi, beforeEach } from "vitest";

// Epic 21 #6 (rework, 14 Oct 2026) — the account's one editable main synopsis:
// ADMIN and ASSESSOR save it, every save is audited against the account (so
// every year's History tab shows it), and the audit row carries no prose.

let role = "ADMIN";
const requireRoleMock = vi.fn(async (allowed: string[]) => {
  if (!allowed.includes(role)) throw new Error("Forbidden");
  return { id: "user-1", role, email: "u@example.test", firstName: "U", lastName: "Ser" };
});
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return { ...actual, requireRole: (allowed: string[]) => requireRoleMock(allowed) };
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

import { saveMainSynopsisAction } from "../account-synopsis-actions";

function makeFakeTx(
  main: { id: string; body: string } | null = { id: "main-1", body: "Old text" },
  bursaryAccountId: string | null = "acc-1"
) {
  return {
    application: { findUnique: vi.fn(async () => ({ bursaryAccountId })) },
    accountSynopsisEntry: {
      findFirst: vi.fn(async () => main),
      create: vi.fn(async () => ({ id: "main-new" })),
      update: vi.fn(async () => ({ id: main?.id ?? "?" })),
    },
  };
}

function audit() {
  return auditMock.mock.calls[0]?.[1] as {
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  };
}

describe("saveMainSynopsisAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    role = "ADMIN";
  });

  it("an ADMIN edits the main synopsis; audited on the account, lengths only", async () => {
    fakeTx = makeFakeTx();
    const res = await saveMainSynopsisAction({ applicationId: "app-1", body: "  New text.  " });

    expect(res).toEqual({ success: true });
    expect(fakeTx.accountSynopsisEntry.findFirst).toHaveBeenCalledWith({
      where: { bursaryAccountId: "acc-1", kind: "MAIN" },
      select: { id: true, body: true },
    });
    expect(fakeTx.accountSynopsisEntry.update).toHaveBeenCalledWith({
      where: { id: "main-1" },
      data: { body: "New text." },
      select: { id: true },
    });
    expect(audit()).toMatchObject({
      action: "ACCOUNT_MAIN_SYNOPSIS_SAVED",
      entityType: "BursaryAccount",
      entityId: "acc-1",
      metadata: { applicationId: "app-1", entryId: "main-1", previousLength: 8, length: 9 },
    });
    expect(JSON.stringify(audit())).not.toContain("New text");
  });

  it("an ASSESSOR creates the main synopsis when the account has none", async () => {
    role = "ASSESSOR";
    fakeTx = makeFakeTx(null);
    const res = await saveMainSynopsisAction({ applicationId: "app-1", body: "First words." });

    expect(res).toEqual({ success: true });
    expect(fakeTx.accountSynopsisEntry.create).toHaveBeenCalledWith({
      data: { bursaryAccountId: "acc-1", kind: "MAIN", body: "First words.", createdById: "user-1" },
      select: { id: true },
    });
    expect(audit()).toMatchObject({ metadata: { entryId: "main-new", previousLength: 0 } });
  });

  it("an unchanged save writes nothing and logs nothing", async () => {
    fakeTx = makeFakeTx({ id: "main-1", body: "Same" });
    const res = await saveMainSynopsisAction({ applicationId: "app-1", body: " Same " });
    expect(res).toEqual({ success: true });
    expect(fakeTx.accountSynopsisEntry.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("staff may clear it", async () => {
    fakeTx = makeFakeTx();
    const res = await saveMainSynopsisAction({ applicationId: "app-1", body: "   " });
    expect(res).toEqual({ success: true });
    expect(fakeTx.accountSynopsisEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { body: "" } })
    );
  });

  it("a VIEWER cannot save", async () => {
    role = "VIEWER";
    fakeTx = makeFakeTx();
    const res = await saveMainSynopsisAction({ applicationId: "app-1", body: "Hello" });
    expect(res.success).toBe(false);
    expect(fakeTx.accountSynopsisEntry.update).not.toHaveBeenCalled();
  });

  it("refuses an application without a bursary account", async () => {
    fakeTx = makeFakeTx(null, null);
    const res = await saveMainSynopsisAction({ applicationId: "app-1", body: "Hello" });
    expect(res).toEqual({ success: false, error: "This application has no bursary account." });
    expect(fakeTx.accountSynopsisEntry.create).not.toHaveBeenCalled();
  });
});
