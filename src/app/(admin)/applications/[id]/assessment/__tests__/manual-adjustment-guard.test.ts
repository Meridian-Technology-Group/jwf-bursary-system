import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Epic 13 / C2 (D13-3) — the manual income-adjustment line's mandatory reason,
 * enforced SERVER-SIDE.
 *
 * Tested at the ACTION layer, not through the form, for the same reason C1's
 * completed-lock is: the browser can be skipped (stale tab, replayed request,
 * a direct server-action call), so a component test would prove nothing about
 * what is actually allowed to be written. The form's inline refusal is a
 * courtesy; `saveAssessmentAction` is the rule.
 *
 * Boundary-mock pattern copied verbatim from ./reopen.test.ts.
 */

// ─── Boundary mocks ───────────────────────────────────────────────────────────

const currentUser = {
  id: "admin-1",
  role: "ADMIN",
  email: "admin@example.test",
  firstName: "Al",
  lastName: "Admin",
};

vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: vi.fn(async () => currentUser),
    requireApplicationAccess: vi.fn(async () => {}),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const auditMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...args),
}));

vi.mock("@/lib/db/queries/assessments", () => ({
  createAssessment: vi.fn(async () => ({ id: "asmt-new" })),
  saveAssessment: vi.fn(async () => ({})),
  completeAssessment: vi.fn(async () => ({})),
  pauseAssessment: vi.fn(async () => ({})),
}));

vi.mock("@/lib/db/queries/contributors", () => ({
  getSecondaryContributor: vi.fn(async () => null),
}));

vi.mock("@/lib/bursary-accounts/lifecycle", () => ({
  mirrorApplicationToSchedule: vi.fn(async () => "entry-1"),
  closeAccountIfComplete: vi.fn(async () => ({ closed: false })),
  reopenAccountForAssessmentYear: vi.fn(async () => ({
    scheduleEntryReopened: false,
    accountReopened: false,
  })),
}));

let fakeTx: ReturnType<typeof makeSaveTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { saveAssessmentAction } from "../actions";
import { saveAssessment } from "@/lib/db/queries/assessments";
import { MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE } from "@/lib/assessment/v2/manual-adjustment";
import type { AssessmentSaveInput } from "@/lib/db/queries/assessments";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** The STORED row the guard reads when the save payload omits a field. */
function makeSaveTx(
  stored: {
    status?: string;
    manualAdjustment?: number | null;
    manualAdjustmentReason?: string | null;
  } = {}
) {
  const row = {
    status: stored.status ?? "IN_PROGRESS",
    manualAdjustment: stored.manualAdjustment ?? 0,
    manualAdjustmentReason: stored.manualAdjustmentReason ?? null,
  };
  return {
    assessment: {
      findUnique: vi.fn(async () => row),
      findUniqueOrThrow: vi.fn(async () => ({ status: row.status })),
      update: vi.fn(async () => ({})),
    },
    recommendation: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
}

const save = (data: Partial<AssessmentSaveInput>) =>
  saveAssessmentAction("asmt-1", "app-1", data as AssessmentSaveInput);

beforeEach(() => {
  vi.clearAllMocks();
  fakeTx = makeSaveTx();
});

// ─── The rule ─────────────────────────────────────────────────────────────────

describe("saveAssessmentAction — manual income adjustment needs a reason (C2)", () => {
  it("REJECTS a non-zero adjustment with a blank reason, and writes nothing", async () => {
    const res = await save({
      manualAdjustment: 12_500,
      manualAdjustmentReason: "",
    });

    expect(res).toEqual({
      success: false,
      error: MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE,
    });
    expect(saveAssessment).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("REJECTS a non-zero adjustment with a null reason", async () => {
    const res = await save({
      manualAdjustment: 12_500,
      manualAdjustmentReason: null,
    });
    expect(res.success).toBe(false);
    expect(saveAssessment).not.toHaveBeenCalled();
  });

  it("REJECTS a whitespace-only reason", async () => {
    const res = await save({
      manualAdjustment: -12_500,
      manualAdjustmentReason: "   ",
    });
    expect(res.success).toBe(false);
    expect(saveAssessment).not.toHaveBeenCalled();
  });

  it("REJECTS a NEGATIVE adjustment with no reason (the rule is sign-blind)", async () => {
    const res = await save({
      manualAdjustment: -4_000,
      manualAdjustmentReason: "",
    });
    expect(res).toEqual({
      success: false,
      error: MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE,
    });
  });

  it("accepts a POSITIVE adjustment with a reason", async () => {
    const res = await save({
      manualAdjustment: 12_500,
      manualAdjustmentReason: "Second parent's income added (separated household)",
    });
    expect(res).toEqual({ success: true });
    expect(saveAssessment).toHaveBeenCalledTimes(1);
  });

  it("accepts a NEGATIVE adjustment with a reason — the line must be able to deduct", async () => {
    const res = await save({
      manualAdjustment: -4_000,
      manualAdjustmentReason: "Maintenance double-counted",
    });
    expect(res).toEqual({ success: true });
    expect(saveAssessment).toHaveBeenCalledTimes(1);
  });

  it("accepts a zero adjustment with no reason", async () => {
    const res = await save({
      manualAdjustment: 0,
      manualAdjustmentReason: null,
    });
    expect(res).toEqual({ success: true });
  });

  it("leaves saves that never mention the adjustment untouched", async () => {
    const res = await save({ annualFees: 1_000 });
    expect(res).toEqual({ success: true });
    expect(saveAssessment).toHaveBeenCalledTimes(1);
  });
});

// ─── Partial payloads: the guard resolves against the STORED row ──────────────

describe("saveAssessmentAction — partial payloads cannot sneak past the guard", () => {
  it("REJECTS raising the amount while leaving the (absent) stored reason alone", async () => {
    fakeTx = makeSaveTx({ manualAdjustment: 0, manualAdjustmentReason: null });
    const res = await save({ manualAdjustment: 9_000 });
    expect(res).toEqual({
      success: false,
      error: MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE,
    });
    expect(saveAssessment).not.toHaveBeenCalled();
  });

  it("REJECTS clearing the reason while leaving a stored non-zero amount alone", async () => {
    fakeTx = makeSaveTx({
      manualAdjustment: 9_000,
      manualAdjustmentReason: "Second parent's income",
    });
    const res = await save({ manualAdjustmentReason: "" });
    expect(res).toEqual({
      success: false,
      error: MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE,
    });
    expect(saveAssessment).not.toHaveBeenCalled();
  });

  it("ALLOWS raising the amount when the stored reason already explains it", async () => {
    fakeTx = makeSaveTx({
      manualAdjustment: 9_000,
      manualAdjustmentReason: "Second parent's income",
    });
    const res = await save({ manualAdjustment: 11_000 });
    expect(res).toEqual({ success: true });
    expect(saveAssessment).toHaveBeenCalledTimes(1);
  });

  it("ALLOWS clearing the reason once the amount has gone back to zero", async () => {
    fakeTx = makeSaveTx({
      manualAdjustment: 9_000,
      manualAdjustmentReason: "Second parent's income",
    });
    const res = await save({
      manualAdjustment: 0,
      manualAdjustmentReason: null,
    });
    expect(res).toEqual({ success: true });
    expect(saveAssessment).toHaveBeenCalledTimes(1);
  });
});
