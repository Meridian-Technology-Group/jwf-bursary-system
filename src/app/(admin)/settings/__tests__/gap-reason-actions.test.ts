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

// `live` is what findMany returns for the re-rank step (the non-deprecated
// codes); `currentRank` is what findUnique returns for the row being edited.
function makeFakeTx(
  overrides: Record<string, unknown> = {},
  {
    live = [] as { id: string; code: number; rank: number | null }[],
    currentRank = null as number | null,
  } = {}
) {
  return {
    gapReason: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "new-id",
        ...args.data,
      })),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: args.where.id,
        sortOrder: 0,
        isDeprecated: false,
        ...args.data,
      })),
      findUnique: vi.fn(async () => ({ rank: currentRank })),
      findMany: vi.fn(async () => live),
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

  // ─── Epic 21 #2 — rank ──────────────────────────────────────────────────

  const live = [
    { id: "r1", code: 101, rank: 1 },
    { id: "r2", code: 102, rank: 2 },
    { id: "r3", code: 103, rank: 3 },
  ];

  function rankWrites() {
    return fakeTx.gapReason.update.mock.calls
      .map((c) => c[0] as { where: { id: string }; data: Record<string, unknown> })
      .filter((a) => "rank" in a.data)
      .map((a) => [a.where.id, a.data.rank]);
  }

  it("rejects a rank that is not a whole number from 1", async () => {
    for (const bad of ["0", "-2", "1.5", "x"]) {
      const res = await upsertGapReasonAction(
        formDataFor({ code: "121", label: "New code", isDeprecated: "false", sortOrder: "21", rank: bad })
      );
      expect(res).toEqual({
        success: false,
        error: "Rank must be a whole number from 1 (or blank for unranked).",
      });
    }
    expect(fakeTx.gapReason.create).not.toHaveBeenCalled();
  });

  it("inserts a new code at a taken rank and moves the others down", async () => {
    fakeTx = makeFakeTx({}, { live: [...live, { id: "new-id", code: 121, rank: null }] });
    const res = await upsertGapReasonAction(
      formDataFor({ code: "121", label: "New code", isDeprecated: "false", sortOrder: "21", rank: "2" })
    );

    expect(res).toEqual({ success: true });
    expect(rankWrites()).toEqual([
      ["new-id", 2],
      ["r2", 3],
      ["r3", 4],
    ]);
    const meta = (auditMock.mock.calls[0]?.[1] as unknown as { metadata: Record<string, unknown> })
      .metadata;
    expect(meta.rank).toBe(2);
    expect(meta.sortOrder).toBe(21);
    expect(meta.reranked).toEqual([
      { code: 102, from: 2, to: 3 },
      { code: 103, from: 3, to: 4 },
    ]);
  });

  it("keeps the rank when the deprecate toggle is not used (label edit re-posts the rank)", async () => {
    fakeTx = makeFakeTx({}, { live, currentRank: 2 });
    const res = await upsertGapReasonAction(
      formDataFor({ id: "r2", code: "102", label: "Renamed", isDeprecated: "false", sortOrder: "2", rank: "2" })
    );

    expect(res).toEqual({ success: true });
    expect(rankWrites()).toEqual([]);
  });

  it("unranks a code on deprecation and closes the gap", async () => {
    // The deprecated row is no longer live, so findMany omits it.
    fakeTx = makeFakeTx({}, { live: live.filter((g) => g.id !== "r1"), currentRank: 1 });
    const res = await upsertGapReasonAction(
      formDataFor({ id: "r1", code: "101", label: "Retired", isDeprecated: "true", sortOrder: "1", rank: "1" })
    );

    expect(res).toEqual({ success: true });
    expect(rankWrites()).toEqual([
      ["r2", 1],
      ["r3", 2],
      ["r1", null],
    ]);
  });
});
