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

import { createNotionalCostConfigVersionAction } from "../actions";

function makeFakeTx(existingEffectiveFroms: Date[] = []) {
  return {
    notionalCostConfig: {
      findMany: vi.fn(async () => existingEffectiveFroms.map((effectiveFrom) => ({ effectiveFrom }))),
      createMany: vi.fn(async (args: { data: unknown[] }) => ({ count: args.data.length })),
    },
  };
}

function validRow(overrides: Partial<{ category: number; costType: string; amount: number }> = {}) {
  return { category: 1, costType: "RENT", amount: 19000, ...overrides };
}

describe("createNotionalCostConfigVersionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeTx = makeFakeTx();
  });

  it("rejects an empty rows array", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify([]));
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createNotionalCostConfigVersionAction(fd);
    expect(res).toEqual({ success: false, error: "At least one notional cost row is required." });
    expect(fakeTx.notionalCostConfig.createMany).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON in the rows field", async () => {
    const fd = new FormData();
    fd.set("rows", "{not json");
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createNotionalCostConfigVersionAction(fd);
    expect(res.success).toBe(false);
    expect(fakeTx.notionalCostConfig.createMany).not.toHaveBeenCalled();
  });

  it("rejects a missing effective date", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify([validRow()]));

    const res = await createNotionalCostConfigVersionAction(fd);
    expect(res).toEqual({ success: false, error: "A valid effective date is required." });
  });

  it("rejects an invalid cost type", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify([validRow({ costType: "NOT_A_TYPE" })]));
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createNotionalCostConfigVersionAction(fd);
    expect(res.success).toBe(false);
    expect(fakeTx.notionalCostConfig.createMany).not.toHaveBeenCalled();
  });

  it("rejects a negative amount", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify([validRow({ amount: -5 })]));
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createNotionalCostConfigVersionAction(fd);
    expect(res.success).toBe(false);
  });

  it("rejects a duplicate effective date before touching createMany", async () => {
    fakeTx = makeFakeTx([new Date("2027-09-01")]);
    const fd = new FormData();
    fd.set("rows", JSON.stringify([validRow()]));
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createNotionalCostConfigVersionAction(fd);
    expect(res.success).toBe(false);
    expect(fakeTx.notionalCostConfig.createMany).not.toHaveBeenCalled();
  });

  it("creates a new version and writes SETTINGS_NOTIONAL_COST_CONFIG_VERSION_CREATE", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify([validRow(), validRow({ category: 2, amount: 19000 })]));
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createNotionalCostConfigVersionAction(fd);
    expect(res).toEqual({ success: true });
    expect(fakeTx.notionalCostConfig.createMany).toHaveBeenCalledTimes(1);
    const auditArg = auditMock.mock.calls[0]?.[1] as unknown as { action: string };
    expect(auditArg.action).toBe("SETTINGS_NOTIONAL_COST_CONFIG_VERSION_CREATE");
  });

  it("requires ADMIN role", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify([validRow()]));
    fd.set("effectiveFrom", "2027-09-01");

    await createNotionalCostConfigVersionAction(fd);
    expect(requireRoleMock).toHaveBeenCalledTimes(1);
  });
});
