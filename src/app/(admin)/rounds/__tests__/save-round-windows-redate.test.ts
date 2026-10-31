import { describe, it, expect, vi, beforeEach } from "vitest";

// Epic 21 R2 — saving a round's windows re-dates that academic year's
// still-planned rolling-over schedule rows (year ≥ 2, SCHEDULED, no round).

vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", email: "a@example.test" })),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const auditMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...args),
}));

let fakeTx: ReturnType<typeof makeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { saveRoundWindowsAction } from "../actions";

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

function makeTx(academicYear: string, ra: { opensOn: Date | null; submitBy: Date | null } | null) {
  return {
    round: { findUnique: vi.fn(async () => ({ id: "round-1", academicYear })) },
    roundWindow: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => ra),
    },
    bursaryScheduleEntry: { updateMany: vi.fn(async () => ({ count: 3 })) },
  };
}

function updateArg() {
  return (fakeTx.bursaryScheduleEntry.updateMany.mock.calls as unknown as unknown[][])[0][0] as {
    where: Record<string, unknown>;
    data: { availableOn: Date; requiredBy: Date };
  };
}

describe("saveRoundWindowsAction — re-dates planned rolling-over rows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves 2027-28's planned rows onto the 2027/28 round's RA window", async () => {
    fakeTx = makeTx("2027/28", { opensOn: day("2027-04-15"), submitBy: day("2027-05-22") });
    const res = await saveRoundWindowsAction("round-1", [
      { scenario: "RA", opensOn: "2027-04-15", submitBy: "2027-05-22", defaultTaxYear: null },
    ]);
    expect(res).toEqual({ success: true });

    const { where, data } = updateArg();
    expect(where).toMatchObject({
      academicYear: "2027-28",
      scheduleYear: { gte: 2 },
      status: "SCHEDULED",
      roundId: null,
    });
    expect(data).toEqual({ availableOn: day("2027-04-15"), requiredBy: day("2027-05-22") });
    expect(auditMock.mock.calls[0][1]).toMatchObject({ metadata: { redatedScheduleRows: 3 } });
  });

  it("clearing the RA window puts the rows back on the placeholder (15 Apr / 22 May)", async () => {
    fakeTx = makeTx("2027/28", null);
    await saveRoundWindowsAction("round-1", [
      { scenario: "RA", opensOn: null, submitBy: null, defaultTaxYear: null },
    ]);
    expect(fakeTx.roundWindow.deleteMany).toHaveBeenCalled();
    expect(updateArg().data).toEqual({ availableOn: day("2027-04-15"), requiredBy: day("2027-05-22") });
  });

  it("moving windows OFF 2026/27 never touches its year-1 rows (the where excludes them)", async () => {
    fakeTx = makeTx("2026/27", null);
    await saveRoundWindowsAction("round-1", [
      { scenario: "RA", opensOn: null, submitBy: null, defaultTaxYear: null },
      { scenario: "NA_NEXT_WINTER", opensOn: null, submitBy: null, defaultTaxYear: null },
    ]);
    const { where } = updateArg();
    expect(where.scheduleYear).toEqual({ gte: 2 });
    expect(where.academicYear).toBe("2026-27");
  });
});
