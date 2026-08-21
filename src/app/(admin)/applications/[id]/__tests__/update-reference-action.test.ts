import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks ───────────────────────────────────────────────────────────
// This suite imports the shared `actions.ts` (item 11's
// updateApplicationReferenceAction lives alongside the other application
// actions), which transitively reaches `@/lib/email/send` → `@/lib/email/resend`
// — the real resend module throws at import time when RESEND_API_KEY is unset,
// so it's boundary-mocked here (same pattern as
// applications/[id]/edit/__tests__/edit-actions.test.ts).

const ADMIN_USER = {
  id: "admin-1",
  role: "ADMIN",
  email: "admin@example.test",
  firstName: "Al",
  lastName: "Admin",
};

const requireRoleMock = vi.fn(async () => ADMIN_USER);
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...(args as [])),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...(args as [])),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
}));

import { updateApplicationReferenceAction } from "../actions";

function makeFakeTx(overrides: Record<string, unknown> = {}) {
  return {
    application: {
      findUnique: vi.fn(async () => ({
        id: "app-1",
        reference: "WS-20252026-0001",
      })),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    ...overrides,
  };
}

describe("updateApplicationReferenceAction (item 11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue(ADMIN_USER);
  });

  it("rejects a blank reference without touching the DB", async () => {
    fakeTx = makeFakeTx();
    const res = await updateApplicationReferenceAction("app-1", "   ");
    expect(res).toEqual({
      success: false,
      error: "Bursary reference cannot be blank.",
    });
    expect(fakeTx.application.findUnique).not.toHaveBeenCalled();
    expect(fakeTx.application.update).not.toHaveBeenCalled();
  });

  it("saves a valid new reference and audits with from/to", async () => {
    fakeTx = makeFakeTx();
    const res = await updateApplicationReferenceAction("app-1", "WS-NEW-0099");

    expect(res).toEqual({ success: true });
    expect(fakeTx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { reference: "WS-NEW-0099" },
    });

    expect(auditMock).toHaveBeenCalledTimes(1);
    const [, entry] = auditMock.mock.calls[0] as unknown as [unknown, {
      action: string;
      entityType: string;
      entityId: string;
      metadata: { from: string; to: string };
    }];
    expect(entry.action).toBe("UPDATE_REFERENCE");
    expect(entry.entityType).toBe("Application");
    expect(entry.entityId).toBe("app-1");
    expect(entry.metadata).toEqual({
      from: "WS-20252026-0001",
      to: "WS-NEW-0099",
    });
  });

  it("preserves whitespace/special characters verbatim (no normalisation)", async () => {
    fakeTx = makeFakeTx();
    const messy = "  odd ref / #1  ";
    const res = await updateApplicationReferenceAction("app-1", messy);

    expect(res).toEqual({ success: true });
    expect(fakeTx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { reference: messy },
    });
  });

  it("is a no-op when re-saved with the current value unchanged (case-sensitively identical) — no write, no audit", async () => {
    fakeTx = makeFakeTx();
    const res = await updateApplicationReferenceAction(
      "app-1",
      "WS-20252026-0001"
    );

    expect(res).toEqual({ success: true });
    expect(fakeTx.application.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("treats a case-only change as a real change, not a no-op", async () => {
    fakeTx = makeFakeTx();
    // Current is "WS-20252026-0001"; saving the same text in a different case
    // is not a case-sensitively-identical no-op, so it proceeds to update.
    const res = await updateApplicationReferenceAction(
      "app-1",
      "ws-20252026-0001"
    );

    expect(res).toEqual({ success: true });
    expect(fakeTx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { reference: "ws-20252026-0001" },
    });
  });

  // ─── D13-1a: the reference is a non-unique label ───────────────────────────

  it("accepts a reference already held by another application — duplicates are legitimate (D13-1a)", async () => {
    // Another application already holds "ABC-1". Under the old Story 11.2 rule
    // this was rejected; the reference is now a label edited to match the
    // external fees system, where two applications may share a code.
    fakeTx = makeFakeTx({
      application: {
        findUnique: vi.fn(async () => ({
          id: "app-1",
          reference: "WS-20252026-0001",
        })),
        findFirst: vi.fn(async () => ({ reference: "ABC-1" })),
        update: vi.fn(async () => ({})),
      },
    });

    const res = await updateApplicationReferenceAction("app-1", "abc-1");

    expect(res).toEqual({ success: true });
    expect(fakeTx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { reference: "abc-1" },
    });
    // The duplicate pre-check is gone entirely — not merely ignored.
    expect(fakeTx.application.findFirst).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("accepts an external fees-system code verbatim, duplicates and punctuation included", async () => {
    fakeTx = makeFakeTx();
    const feesCode = "TS-SMITH05-Smith, Bob";

    const res = await updateApplicationReferenceAction("app-1", feesCode);

    expect(res).toEqual({ success: true });
    expect(fakeTx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { reference: feesCode },
    });
  });

  it("surfaces an unexpected DB error as-is — there is no unique-constraint remapping left", async () => {
    fakeTx = makeFakeTx({
      application: {
        findUnique: vi.fn(async () => ({
          id: "app-1",
          reference: "WS-20252026-0001",
        })),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => {
          throw new Error("connection terminated unexpectedly");
        }),
      },
    });

    const res = await updateApplicationReferenceAction("app-1", "ABC-1");

    expect(res).toEqual({
      success: false,
      error: "connection terminated unexpectedly",
    });
    expect(auditMock).not.toHaveBeenCalled();
  });

  // ─── Editability is NOT lifecycle-gated (Story 11.1, re-pinned for C1) ─────

  // The reference is explicitly exempt from state-gating: its primary use is
  // reconciliation against the external fees system AFTER an award, so it must
  // stay editable in every terminal state. C1 adds new assessment status guards
  // in this same sprint — this test exists so such a guard cannot silently
  // start catching the reference edit.
  it.each([
    ["closed", { closedAt: new Date("2026-03-01T00:00:00Z"), archivedAt: null }],
    ["archived", { closedAt: null, archivedAt: new Date("2026-03-01T00:00:00Z") }],
    [
      "closed and archived",
      {
        closedAt: new Date("2026-03-01T00:00:00Z"),
        archivedAt: new Date("2026-03-02T00:00:00Z"),
      },
    ],
  ])(
    "stays editable when the application is %s (no lifecycle gate)",
    async (_label, lifecycle) => {
      fakeTx = makeFakeTx({
        application: {
          findUnique: vi.fn(async () => ({
            id: "app-1",
            reference: "WS-20252026-0001",
            ...lifecycle,
          })),
          findFirst: vi.fn(async () => null),
          update: vi.fn(async () => ({})),
        },
      });

      const res = await updateApplicationReferenceAction(
        "app-1",
        "TS-SMITH05-Smith, Bob"
      );

      expect(res).toEqual({ success: true });
      expect(fakeTx.application.update).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: { reference: "TS-SMITH05-Smith, Bob" },
      });
      expect(auditMock).toHaveBeenCalledTimes(1);
    }
  );

  it("fails cleanly when the application does not exist", async () => {
    fakeTx = makeFakeTx({
      application: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
    });

    const res = await updateApplicationReferenceAction("missing", "ABC-1");
    expect(res.success).toBe(false);
    expect(fakeTx.application.update).not.toHaveBeenCalled();
  });

  it("is role-gated: a non-ADMIN caller is rejected before any DB write", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Forbidden"));
    fakeTx = makeFakeTx();

    await expect(
      updateApplicationReferenceAction("app-1", "ABC-1")
    ).rejects.toThrow("Forbidden");
    expect(fakeTx.application.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});
