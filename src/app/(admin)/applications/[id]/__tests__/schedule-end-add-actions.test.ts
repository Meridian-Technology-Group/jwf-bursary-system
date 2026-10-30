import { describe, it, expect, vi, beforeEach } from "vitest";

// Epic 21 #4 — "End after this year" / "Add a year". The planners
// (planEndAfterYear / planAddYear / planSchedule) run for real against a fake
// transaction; only the auth, audit, cache and DB boundaries are mocked.

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

import { endScheduleAfterYearAction, addScheduleYearAction } from "../schedule-actions";

type Status = "SCHEDULED" | "RECEIVED" | "COMPLETE";
function entry(scheduleYear: number, status: Status = "SCHEDULED", applicationId: string | null = null) {
  const start = 2025 + scheduleYear;
  return {
    id: `e${scheduleYear}`,
    scheduleYear,
    academicYear: `${start}-${String(start + 1).slice(-2)}`,
    status,
    applicationId,
  };
}

function makeFakeTx({
  entries = [entry(1, "COMPLETE", "app-1"), entry(2), entry(3)],
  account = {} as Record<string, unknown>,
  roundYear = "2026/27",
} = {}) {
  return {
    application: {
      findUnique: vi.fn(async () => ({
        bursaryAccountId: "acc-1",
        round: { academicYear: roundYear },
      })),
    },
    bursaryAccount: {
      findUnique: vi.fn(async () => ({
        id: "acc-1",
        school: "WHITGIFT",
        // Y11 entry → Years 11–13 → natural horizon 3.
        entryYearGroup: "Y11",
        firstAssessmentYear: "2026/27",
        status: "ACTIVE",
        closedAt: null,
        closeReasonId: null,
        scheduleEndYear: null,
        scheduleEntries: entries,
        ...account,
      })),
      update: vi.fn(async () => ({})),
    },
    // Epic 21 R2 — later schedule years read each round's stored RA window.
    roundWindow: { findMany: vi.fn(async () => [] as unknown[]) },
    bursaryScheduleEntry: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({})),
    },
    round: {
      findUnique: vi.fn(async () => ({
        openDate: new Date("2026-04-15"),
        closeDate: new Date("2026-05-21"),
      })),
    },
  };
}

function auditArg() {
  return auditMock.mock.calls[0]?.[1] as {
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  };
}

describe("endScheduleAfterYearAction (Epic 21 #4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is ADMIN only", async () => {
    fakeTx = makeFakeTx();
    await endScheduleAfterYearAction({ applicationId: "app-1", reason: "Conditional award" });
    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("requires a reason", async () => {
    fakeTx = makeFakeTx();
    const res = await endScheduleAfterYearAction({ applicationId: "app-1", reason: "  " });
    expect(res.success).toBe(false);
    expect(fakeTx.bursaryScheduleEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("removes the later years, records the end and audits against the application", async () => {
    fakeTx = makeFakeTx();
    const res = await endScheduleAfterYearAction({ applicationId: "app-1", reason: "Conditional award, one year" });

    expect(res).toEqual({ success: true });
    expect(fakeTx.bursaryScheduleEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["e2", "e3"] }, status: "SCHEDULED" },
    });
    expect(fakeTx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { scheduleEndYear: 1, scheduleYears: 1 },
    });
    const audit = auditArg();
    expect(audit.action).toBe("SCHEDULE_ENDED_AFTER_YEAR");
    expect(audit.entityType).toBe("Application");
    expect(audit.entityId).toBe("app-1");
    expect(audit.metadata).toMatchObject({
      bursaryAccountId: "acc-1",
      removedYears: ["2027-28", "2028-29"],
      reason: "Conditional award, one year",
    });
  });

  it("finds this year by the round's academic year when the row isn't linked", async () => {
    fakeTx = makeFakeTx({ entries: [entry(1, "COMPLETE"), entry(2), entry(3)] });
    const res = await endScheduleAfterYearAction({ applicationId: "app-1", reason: "Conditional award" });
    expect(res).toEqual({ success: true });
  });

  it("refuses when a later year has started, and changes nothing", async () => {
    fakeTx = makeFakeTx({ entries: [entry(1, "COMPLETE", "app-1"), entry(2, "RECEIVED"), entry(3)] });
    const res = await endScheduleAfterYearAction({ applicationId: "app-1", reason: "Conditional award" });
    expect(res).toEqual({ success: false, error: expect.stringContaining("2027-28 has already started") });
    expect(fakeTx.bursaryScheduleEntry.deleteMany).not.toHaveBeenCalled();
    expect(fakeTx.bursaryAccount.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("addScheduleYearAction (Epic 21 #4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds the next year with generation's dates and labels", async () => {
    fakeTx = makeFakeTx({ entries: [entry(1, "COMPLETE", "app-1")], account: { scheduleEndYear: 1 } });
    const res = await addScheduleYearAction({ applicationId: "app-1", reason: "Headmaster extended the award" });

    expect(res).toEqual({ success: true });
    const created = (fakeTx.bursaryScheduleEntry.create.mock.calls as unknown as unknown[][])[0][0] as {
      data: Record<string, unknown>;
    };
    expect(created.data).toMatchObject({
      bursaryAccountId: "acc-1",
      scheduleYear: 2,
      academicYear: "2027-28",
      manuallyCreated: true,
    });
    expect((created.data.availableOn as Date).toISOString().slice(0, 10)).toBe("2027-04-15");
    // Still short of the natural horizon (3), so the end moves on to 2.
    expect(fakeTx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { scheduleEndYear: 2, scheduleYears: 2 },
    });
    expect(auditArg().metadata).toMatchObject({ scheduleYear: 2, reopened: false });
  });

  it("clears the end once the schedule reaches its natural horizon", async () => {
    fakeTx = makeFakeTx({ entries: [entry(1, "COMPLETE", "app-1"), entry(2)], account: { scheduleEndYear: 2 } });
    await addScheduleYearAction({ applicationId: "app-1", reason: "Back to the full award" });
    expect(fakeTx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { scheduleEndYear: null, scheduleYears: 3 },
    });
  });

  it("refuses past the final eligible year (no Year 14)", async () => {
    fakeTx = makeFakeTx();
    const res = await addScheduleYearAction({ applicationId: "app-1", reason: "One more year" });
    expect(res).toEqual({ success: false, error: expect.stringContaining("Year 13") });
    expect(fakeTx.bursaryScheduleEntry.create).not.toHaveBeenCalled();
  });

  it("re-opens a CLOSED account and audits the close it reverses", async () => {
    const closedAt = new Date("2027-06-30T10:00:00Z");
    fakeTx = makeFakeTx({
      entries: [entry(1, "COMPLETE", "app-1")],
      account: { status: "CLOSED", closedAt, closeReasonId: "reason-1", scheduleEndYear: 1 },
    });
    const res = await addScheduleYearAction({ applicationId: "app-1", reason: "Headmaster re-opened the file" });

    expect(res).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: {
        scheduleEndYear: 2,
        scheduleYears: 2,
        status: "ACTIVE",
        closedAt: null,
        closeReasonId: null,
      },
    });
    expect(auditArg().metadata).toMatchObject({
      reopened: true,
      previousClosedAt: closedAt.toISOString(),
      previousCloseReasonId: "reason-1",
    });
  });
});
