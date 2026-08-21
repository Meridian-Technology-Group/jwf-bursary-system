import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks (mirrors bursary-account-actions.test.ts) ─────────────────

const requireRoleMock = vi.fn(async () => ({
  id: "admin-1",
  role: "ADMIN",
  email: "admin@example.test",
  firstName: "Ad",
  lastName: "Min",
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

const auditMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...(args as [])),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
}));

import { upsertCloseReasonAction } from "../actions";

function makeFakeTx(overrides: Record<string, unknown> = {}) {
  return {
    closeReason: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "new-id",
        ...args.data,
      })),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: args.where.id,
        ...args.data,
      })),
    },
    ...overrides,
  };
}

function formDataFor(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("upsertCloseReasonAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeTx = makeFakeTx();
  });

  it("rejects a missing/blank label without touching the database", async () => {
    const res = await upsertCloseReasonAction(
      formDataFor({ label: "   ", purgeOnClose: "false", isDeprecated: "false", sortOrder: "1" })
    );

    expect(res).toEqual({ success: false, error: "A label is required." });
    expect(fakeTx.closeReason.create).not.toHaveBeenCalled();
    expect(fakeTx.closeReason.update).not.toHaveBeenCalled();
  });

  it("rejects a case-insensitive duplicate label on create", async () => {
    fakeTx = makeFakeTx({
      closeReason: {
        findFirst: vi.fn(async () => ({ id: "existing-id", label: "relocation" })),
        create: vi.fn(),
        update: vi.fn(),
      },
    });

    const res = await upsertCloseReasonAction(
      formDataFor({ label: "Relocation", purgeOnClose: "false", isDeprecated: "false", sortOrder: "1" })
    );

    expect(res).toEqual({
      success: false,
      error: "A close reason with that label already exists.",
    });
    expect(fakeTx.closeReason.create).not.toHaveBeenCalled();
  });

  it("allows saving a reason against itself (duplicate check excludes its own id)", async () => {
    fakeTx = makeFakeTx({
      closeReason: {
        findFirst: vi.fn(async () => ({ id: "row-1", label: "Relocation" })),
        create: vi.fn(),
        update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          ...args.data,
        })),
      },
    });

    const res = await upsertCloseReasonAction(
      formDataFor({
        id: "row-1",
        label: "Relocation",
        purgeOnClose: "true",
        isDeprecated: "false",
        sortOrder: "2",
      })
    );

    expect(res).toEqual({ success: true });
    expect(fakeTx.closeReason.update).toHaveBeenCalledTimes(1);
  });

  it("creates a new close reason and writes an audit log with SETTINGS_CLOSE_REASON_CREATE", async () => {
    const res = await upsertCloseReasonAction(
      formDataFor({
        label: "Accepting another school offer",
        purgeOnClose: "false",
        isDeprecated: "false",
        sortOrder: "3",
      })
    );

    expect(res).toEqual({ success: true });
    expect(fakeTx.closeReason.create).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledTimes(1);
    const auditArg = auditMock.mock.calls[0]?.[1] as unknown as { action: string };
    expect(auditArg.action).toBe("SETTINGS_CLOSE_REASON_CREATE");
  });

  it("updates an existing close reason and writes SETTINGS_CLOSE_REASON_UPDATE", async () => {
    const res = await upsertCloseReasonAction(
      formDataFor({
        id: "row-2",
        label: "Declined by the school",
        purgeOnClose: "true",
        isDeprecated: "false",
        sortOrder: "1",
      })
    );

    expect(res).toEqual({ success: true });
    expect(fakeTx.closeReason.update).toHaveBeenCalledTimes(1);
    const auditArg = auditMock.mock.calls[0]?.[1] as unknown as { action: string };
    expect(auditArg.action).toBe("SETTINGS_CLOSE_REASON_UPDATE");
  });

  it("requires ADMIN role", async () => {
    await upsertCloseReasonAction(
      formDataFor({ label: "Relocation", purgeOnClose: "false", isDeprecated: "false", sortOrder: "1" })
    );

    expect(requireRoleMock).toHaveBeenCalledTimes(1);
  });
});
