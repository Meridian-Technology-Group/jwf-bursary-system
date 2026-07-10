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

import {
  createAffordabilityBandVersionAction,
  createDebtRatioBandVersionAction,
} from "../actions";

function makeFakeTx(modelKey: string, existingEffectiveFroms: Date[] = []) {
  return {
    [modelKey]: {
      findMany: vi.fn(async () => existingEffectiveFroms.map((effectiveFrom) => ({ effectiveFrom }))),
      createMany: vi.fn(async (args: { data: unknown[] }) => ({ count: args.data.length })),
    },
  } as Record<string, { findMany: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> }>;
}

const VALID_AFFORDABILITY_ROWS = [
  { bandFloor: 27001, bandCeiling: 29000, basePct: 0 },
  { bandFloor: 29001, bandCeiling: 32000, basePct: 1 },
];

describe("createAffordabilityBandVersionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeTx = makeFakeTx("affordabilityBand");
  });

  it("rejects a band set with a gap before touching the database", async () => {
    const fd = new FormData();
    fd.set(
      "rows",
      JSON.stringify([
        { bandFloor: 0, bandCeiling: 100, basePct: 1 },
        { bandFloor: 500, bandCeiling: 600, basePct: 2 }, // gap between 100 and 500
      ])
    );
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createAffordabilityBandVersionAction(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/Gap/);
    expect(fakeTx.affordabilityBand.createMany).not.toHaveBeenCalled();
  });

  it("rejects an inverted row (ceiling below floor)", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify([{ bandFloor: 100, bandCeiling: 50, basePct: 1 }]));
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createAffordabilityBandVersionAction(fd);
    expect(res.success).toBe(false);
    expect(fakeTx.affordabilityBand.createMany).not.toHaveBeenCalled();
  });

  it("rejects a duplicate effective date before touching createMany", async () => {
    fakeTx = makeFakeTx("affordabilityBand", [new Date("2027-09-01")]);
    const fd = new FormData();
    fd.set("rows", JSON.stringify(VALID_AFFORDABILITY_ROWS));
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createAffordabilityBandVersionAction(fd);
    expect(res.success).toBe(false);
    expect(fakeTx.affordabilityBand.createMany).not.toHaveBeenCalled();
  });

  it("accepts a valid, contiguous band set and writes the audit action", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify(VALID_AFFORDABILITY_ROWS));
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createAffordabilityBandVersionAction(fd);
    expect(res).toEqual({ success: true });
    expect(fakeTx.affordabilityBand.createMany).toHaveBeenCalledTimes(1);
    const auditArg = auditMock.mock.calls[0]?.[1] as unknown as { action: string };
    expect(auditArg.action).toBe("SETTINGS_AFFORDABILITY_BAND_VERSION_CREATE");
  });

  it("requires ADMIN role", async () => {
    const fd = new FormData();
    fd.set("rows", JSON.stringify(VALID_AFFORDABILITY_ROWS));
    fd.set("effectiveFrom", "2027-09-01");

    await createAffordabilityBandVersionAction(fd);
    expect(requireRoleMock).toHaveBeenCalledTimes(1);
  });
});

describe("createDebtRatioBandVersionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeTx = makeFakeTx("debtRatioBand");
  });

  it("accepts open-ended top/bottom bands with a status label on every row", async () => {
    const fd = new FormData();
    fd.set(
      "rows",
      JSON.stringify([
        { ratioFloor: null, ratioCeiling: 0, minRepaymentMonths: null, statusLabel: "ZERO DEBT" },
        { ratioFloor: 0, ratioCeiling: 1, minRepaymentMonths: 12, statusLabel: "SOME DEBT" },
        { ratioFloor: 1, ratioCeiling: null, minRepaymentMonths: 24, statusLabel: "HEAVY DEBT" },
      ])
    );
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createDebtRatioBandVersionAction(fd);
    expect(res).toEqual({ success: true });
    expect(fakeTx.debtRatioBand.createMany).toHaveBeenCalledTimes(1);
  });

  it("rejects a row missing its status label", async () => {
    const fd = new FormData();
    fd.set(
      "rows",
      JSON.stringify([
        { ratioFloor: null, ratioCeiling: null, minRepaymentMonths: null, statusLabel: "" },
      ])
    );
    fd.set("effectiveFrom", "2027-09-01");

    const res = await createDebtRatioBandVersionAction(fd);
    expect(res).toEqual({ success: false, error: "Every row needs a status label." });
    expect(fakeTx.debtRatioBand.createMany).not.toHaveBeenCalled();
  });
});
