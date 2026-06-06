import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: vi.fn(async () => ({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.test",
      firstName: "Al",
      lastName: "Admin",
    })),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit/log", () => ({ createAuditLog: () => auditMock() }));

// generateSchedule is exercised directly against the fake tx; spy to assert the
// regenerate action delegates to it (idempotency itself is covered by the
// schedule unit tests).
const generateScheduleMock = vi.fn(
  async (..._args: unknown[]) => ({ horizon: 3, created: 1, skipped: 2 })
);
vi.mock("@/lib/bursary-accounts/schedule", () => ({
  generateSchedule: (...args: unknown[]) => generateScheduleMock(...args),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
}));

import {
  regenerateScheduleAction,
  toggleScheduleShowOnPortalAction,
} from "../schedule-actions";

function makeFakeTx(overrides: Record<string, unknown> = {}) {
  return {
    application: {
      findUnique: vi.fn(async () => ({
        bursaryAccountId: "acc-1",
        reference: "APP-1",
      })),
    },
    bursaryAccount: {
      findUnique: vi.fn(async () => ({
        id: "acc-1",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2026/27",
        reference: "BA-1",
      })),
    },
    round: {
      findUnique: vi.fn(async () => ({
        academicYear: "2026/27",
        openDate: new Date("2026-09-01"),
        closeDate: new Date("2026-12-01"),
      })),
    },
    bursaryScheduleEntry: {
      findUnique: vi.fn(async () => ({
        id: "entry-1",
        bursaryAccountId: "acc-1",
        scheduleYear: 2,
        academicYear: "2027-28",
      })),
      update: vi.fn(async () => ({})),
    },
    ...overrides,
  };
}

describe("regenerateScheduleAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to generateSchedule and audits (idempotent top-up)", async () => {
    fakeTx = makeFakeTx();
    const res = await regenerateScheduleAction("app-1");
    expect(res).toEqual({ success: true });
    expect(generateScheduleMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("re-running is safe — still delegates (generateSchedule is idempotent)", async () => {
    fakeTx = makeFakeTx();
    await regenerateScheduleAction("app-1");
    await regenerateScheduleAction("app-1");
    expect(generateScheduleMock).toHaveBeenCalledTimes(2);
  });

  it("fails cleanly when the application has no account", async () => {
    fakeTx = makeFakeTx({
      application: {
        findUnique: vi.fn(async () => ({
          bursaryAccountId: null,
          reference: "APP-1",
        })),
      },
    });
    const res = await regenerateScheduleAction("app-1");
    expect(res.success).toBe(false);
    expect(generateScheduleMock).not.toHaveBeenCalled();
  });

  it("uses null dates when the originating round is missing", async () => {
    fakeTx = makeFakeTx({
      round: { findUnique: vi.fn(async () => null) },
    });
    const res = await regenerateScheduleAction("app-1");
    expect(res).toEqual({ success: true });
    const callArg = generateScheduleMock.mock.calls[0]![2] as unknown as {
      openDate: Date | null;
      closeDate: Date | null;
    };
    expect(callArg.openDate).toBeNull();
    expect(callArg.closeDate).toBeNull();
  });
});

describe("toggleScheduleShowOnPortalAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggles a row that belongs to the application's account", async () => {
    fakeTx = makeFakeTx();
    const res = await toggleScheduleShowOnPortalAction("app-1", "entry-1", true);
    expect(res).toEqual({ success: true });
    expect(fakeTx.bursaryScheduleEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: { showOnPortal: true },
    });
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("refuses an entry from a different account (defence-in-depth)", async () => {
    fakeTx = makeFakeTx({
      bursaryScheduleEntry: {
        findUnique: vi.fn(async () => ({
          id: "entry-x",
          bursaryAccountId: "OTHER-acc",
          scheduleYear: 1,
          academicYear: "2026-27",
        })),
        update: vi.fn(async () => ({})),
      },
    });
    const res = await toggleScheduleShowOnPortalAction("app-1", "entry-x", true);
    expect(res.success).toBe(false);
    expect(fakeTx.bursaryScheduleEntry.update).not.toHaveBeenCalled();
  });
});
