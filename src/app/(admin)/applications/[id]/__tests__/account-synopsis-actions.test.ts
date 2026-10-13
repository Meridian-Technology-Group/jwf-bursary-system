import { describe, it, expect, vi, beforeEach } from "vitest";

// Epic 21 #6 — notes on the account's standing synopsis (D-6): ADMIN and
// ASSESSOR add, ADMIN edits, nobody deletes, YEAR entries are not edited here.

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

import {
  addAccountSynopsisNoteAction,
  editAccountSynopsisNoteAction,
} from "../account-synopsis-actions";

function makeFakeTx(entry: Record<string, unknown> | null = {
  id: "note-1",
  kind: "NOTE",
  bursaryAccountId: "acc-1",
  body: "Old",
}) {
  return {
    application: { findUnique: vi.fn(async () => ({ bursaryAccountId: "acc-1" })) },
    accountSynopsisEntry: {
      create: vi.fn(async () => ({ id: "note-new" })),
      findUnique: vi.fn(async () => entry),
      update: vi.fn(async () => ({})),
    },
  };
}

function audit() {
  return auditMock.mock.calls[0]?.[1] as { action: string; entityType: string; metadata: Record<string, unknown> };
}

describe("addAccountSynopsisNoteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    role = "ADMIN";
  });

  it("an ASSESSOR can add a note; it is attributed and audited on the application", async () => {
    role = "ASSESSOR";
    fakeTx = makeFakeTx();
    const res = await addAccountSynopsisNoteAction({ applicationId: "app-1", body: "  Spoke to the family.  " });

    expect(res).toEqual({ success: true });
    expect(fakeTx.accountSynopsisEntry.create).toHaveBeenCalledWith({
      data: { bursaryAccountId: "acc-1", kind: "NOTE", body: "Spoke to the family.", createdById: "user-1" },
      select: { id: true },
    });
    expect(audit()).toMatchObject({ action: "ACCOUNT_SYNOPSIS_NOTE_ADDED", entityType: "Application" });
  });

  it("refuses an empty note", async () => {
    fakeTx = makeFakeTx();
    const res = await addAccountSynopsisNoteAction({ applicationId: "app-1", body: "  " });
    expect(res.success).toBe(false);
    expect(fakeTx.accountSynopsisEntry.create).not.toHaveBeenCalled();
  });

  it("a VIEWER cannot add a note", async () => {
    role = "VIEWER";
    fakeTx = makeFakeTx();
    const res = await addAccountSynopsisNoteAction({ applicationId: "app-1", body: "Hello" });
    expect(res.success).toBe(false);
    expect(fakeTx.accountSynopsisEntry.create).not.toHaveBeenCalled();
  });
});

describe("editAccountSynopsisNoteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    role = "ADMIN";
  });

  it("an ADMIN edits a note and it is audited", async () => {
    fakeTx = makeFakeTx();
    const res = await editAccountSynopsisNoteAction({ applicationId: "app-1", entryId: "note-1", body: "New" });
    expect(res).toEqual({ success: true });
    expect(fakeTx.accountSynopsisEntry.update).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: { body: "New" },
    });
    expect(audit()).toMatchObject({ action: "ACCOUNT_SYNOPSIS_NOTE_EDITED" });
  });

  it("an ASSESSOR cannot edit", async () => {
    role = "ASSESSOR";
    fakeTx = makeFakeTx();
    const res = await editAccountSynopsisNoteAction({ applicationId: "app-1", entryId: "note-1", body: "New" });
    expect(res.success).toBe(false);
    expect(fakeTx.accountSynopsisEntry.update).not.toHaveBeenCalled();
  });

  it("a YEAR entry is not edited here", async () => {
    fakeTx = makeFakeTx({ id: "year-1", kind: "YEAR", bursaryAccountId: "acc-1", body: "x" });
    const res = await editAccountSynopsisNoteAction({ applicationId: "app-1", entryId: "year-1", body: "New" });
    expect(res).toEqual({ success: false, error: expect.stringContaining("that year's assessment") });
    expect(fakeTx.accountSynopsisEntry.update).not.toHaveBeenCalled();
  });

  it("refuses a note from another account", async () => {
    fakeTx = makeFakeTx({ id: "note-x", kind: "NOTE", bursaryAccountId: "OTHER", body: "x" });
    const res = await editAccountSynopsisNoteAction({ applicationId: "app-1", entryId: "note-x", body: "New" });
    expect(res.success).toBe(false);
    expect(fakeTx.accountSynopsisEntry.update).not.toHaveBeenCalled();
  });
});
