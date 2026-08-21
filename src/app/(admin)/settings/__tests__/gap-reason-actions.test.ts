import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks (mirrors close-reason-actions.test.ts) ────────────────────

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

import { upsertGapReasonAction } from "../actions";

function makeFakeTx(overrides: Record<string, unknown> = {}) {
  return {
    gapReason: {
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

describe("upsertGapReasonAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeTx = makeFakeTx();
  });

  it("rejects a missing label without touching the database", async () => {
    const res = await upsertGapReasonAction(
      formDataFor({ code: "11", label: "   ", isDeprecated: "false", sortOrder: "11" })
    );

    expect(res).toEqual({ success: false, error: "Code and label are required." });
    expect(fakeTx.gapReason.create).not.toHaveBeenCalled();
    expect(fakeTx.gapReason.update).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric code", async () => {
    const res = await upsertGapReasonAction(
      formDataFor({ code: "abc", label: "New gap reason", isDeprecated: "false", sortOrder: "11" })
    );

    expect(res).toEqual({ success: false, error: "Code and label are required." });
    expect(fakeTx.gapReason.create).not.toHaveBeenCalled();
  });

  it("creates a new gap reason and writes SETTINGS_GAP_REASON_CREATE", async () => {
    const res = await upsertGapReasonAction(
      formDataFor({ code: "11", label: "New unforeseen circumstance", isDeprecated: "false", sortOrder: "11" })
    );

    expect(res).toEqual({ success: true });
    expect(fakeTx.gapReason.create).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledTimes(1);
    const auditArg = auditMock.mock.calls[0]?.[1] as unknown as { action: string };
    expect(auditArg.action).toBe("SETTINGS_GAP_REASON_CREATE");
  });

  it("updates an existing gap reason and writes SETTINGS_GAP_REASON_UPDATE", async () => {
    const res = await upsertGapReasonAction(
      formDataFor({
        id: "row-2",
        code: "9",
        label: "Affordability Adjusted Calculation Preferred (revised)",
        isDeprecated: "false",
        sortOrder: "9",
      })
    );

    expect(res).toEqual({ success: true });
    expect(fakeTx.gapReason.update).toHaveBeenCalledTimes(1);
    const auditArg = auditMock.mock.calls[0]?.[1] as unknown as { action: string };
    expect(auditArg.action).toBe("SETTINGS_GAP_REASON_UPDATE");
  });

  it("soft-deprecates via isDeprecated rather than deleting", async () => {
    const res = await upsertGapReasonAction(
      formDataFor({ id: "row-3", code: "2", label: "Original Old Assessment Benchmark (2020)", isDeprecated: "true", sortOrder: "2" })
    );

    expect(res).toEqual({ success: true });
    expect(fakeTx.gapReason.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isDeprecated: true }) })
    );
  });

  it("surfaces a friendly error on a duplicate code", async () => {
    fakeTx = makeFakeTx({
      gapReason: {
        create: vi.fn(async () => {
          throw new Error("Unique constraint failed on the fields: (`code`)");
        }),
        update: vi.fn(),
      },
    });

    const res = await upsertGapReasonAction(
      formDataFor({ code: "1", label: "Duplicate code", isDeprecated: "false", sortOrder: "1" })
    );

    expect(res).toEqual({ success: false, error: "A gap reason with that number already exists." });
  });

  it("requires ADMIN role", async () => {
    await upsertGapReasonAction(
      formDataFor({ code: "11", label: "New gap reason", isDeprecated: "false", sortOrder: "11" })
    );

    expect(requireRoleMock).toHaveBeenCalledTimes(1);
  });
});
