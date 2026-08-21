import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CALC-15 — server-side backstop: `completeAssessmentAction` must reject
 * completing a v2 assessment whose calculation snapshot was never persisted
 * (`totalHouseholdNetIncome IS NULL`). This exercises the REAL wiring through
 * `completeAssessment` (src/lib/db/queries/assessments.ts) down into
 * `completeAssessmentRow` (src/lib/applications/status.ts) — only the auth,
 * transaction, and audit boundaries are mocked — so the guard is proven for
 * the actual code path the assessor form calls, not just the pure primitive.
 *
 * Found during an E2E walkthrough: a stale Prisma client made every
 * `saveAssessmentAction` call throw, yet Complete succeeded anyway, producing
 * a COMPLETED assessment with a null v2 snapshot. This guard is the
 * server-side half of the fix (the client-side half gates Complete on the
 * save's outcome — see save-gate.test.ts).
 */

vi.mock("@/lib/auth/roles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/roles")>(
    "@/lib/auth/roles"
  );
  return {
    ...actual,
    requireRole: vi.fn(async () => ({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.test",
      firstName: "Al",
      lastName: "Admin",
    })),
    requireApplicationAccess: vi.fn(async () => {}),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit/log", () => ({ createAuditLog: () => auditMock() }));

// The assessment row backing every `tx.assessment.findUniqueOrThrow` call
// (completeAssessment's status read, then completeAssessmentRow's snapshot
// read) — Prisma mocks don't project `select`, so the same full row satisfies
// both call sites.
let assessmentRow: {
  status: string;
  calculationVersion: number;
  totalHouseholdNetIncome: number | null;
};

const updateMock = vi.fn(async () => ({}));

function makeFakeTx() {
  return {
    assessment: {
      findUniqueOrThrow: vi.fn(async () => assessmentRow),
      update: updateMock,
    },
    // Backs the post-complete schedule-mirror step (withAdminContext block) —
    // returning no bursaryAccountId short-circuits it as a no-op, which is
    // all that block is for in this test.
    application: {
      findUnique: vi.fn(async () => null),
    },
  };
}

let fakeTx: ReturnType<typeof makeFakeTx>;
const withAdminContextMock = vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakeTx));
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => withAdminContextMock(fn),
}));

import { completeAssessmentAction } from "../actions";

describe("completeAssessmentAction — v2 snapshot guard (CALC-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeTx = makeFakeTx();
  });

  it("REJECTS completing a v2 assessment with a null snapshot and does NOT flip status", async () => {
    assessmentRow = {
      status: "IN_PROGRESS",
      calculationVersion: 2,
      totalHouseholdNetIncome: null,
    };

    const result = await completeAssessmentAction("asmt-1", "app-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/snapshot/i);
    }
    expect(updateMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("ALLOWS completing a v2 assessment once the snapshot is persisted", async () => {
    assessmentRow = {
      status: "IN_PROGRESS",
      calculationVersion: 2,
      totalHouseholdNetIncome: 42000,
    };

    const result = await completeAssessmentAction("asmt-1", "app-1");

    expect(result.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
  });

  it("does not guard a v1 assessment (calculationVersion 1) even with a null total", async () => {
    assessmentRow = {
      status: "IN_PROGRESS",
      calculationVersion: 1,
      totalHouseholdNetIncome: null,
    };

    const result = await completeAssessmentAction("asmt-1", "app-1");

    expect(result.success).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
