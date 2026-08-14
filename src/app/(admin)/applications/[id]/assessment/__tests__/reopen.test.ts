import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Epic 13 / C1 (D13-2) — reopening a completed assessment, and the server-side
 * completed-lock that makes the form's read-only mode real.
 *
 * Both are tested at the ACTION layer, not through the UI, because that is
 * where the rules live: the browser can be skipped (stale tab, replayed
 * request, direct server-action call), so a test that drives the component
 * would prove nothing about who is actually allowed to write.
 *
 * Boundary-mock pattern (see ./begin-gate.test.ts): requireRole returns the
 * caller under test, requireApplicationAccess is a no-op — in production it
 * redirects a non-assigned assessor before the action runs, so stubbing it out
 * is what lets us assert the action's OWN ownership guard rather than the
 * route guard in front of it.
 */

// ─── Boundary mocks ───────────────────────────────────────────────────────────

let currentUser = {
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

const reopenAccountMock = vi.fn(async () => ({
  scheduleEntryReopened: true,
  accountReopened: true,
}));
vi.mock("@/lib/bursary-accounts/lifecycle", () => ({
  mirrorApplicationToSchedule: vi.fn(async () => "entry-1"),
  closeAccountIfComplete: vi.fn(async () => ({ closed: false })),
  reopenAccountForAssessmentYear: (...args: unknown[]) =>
    reopenAccountMock(...(args as [])),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { reopenAssessmentAction, saveAssessmentAction } from "../actions";
import {
  ASSESSMENT_COMPLETED_LOCK_MESSAGE,
  REOPEN_NOT_COMPLETED_MESSAGE,
  REOPEN_OUTCOME_SET_MESSAGE,
  REOPEN_APPLICATION_CLOSED_MESSAGE,
  REOPEN_NOT_ASSIGNED_MESSAGE,
} from "../gate";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { saveAssessment } from "@/lib/db/queries/assessments";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface AssessmentRow {
  id: string;
  applicationId: string;
  status: string;
  outcome: string | null;
  assignedToId: string | null;
  closedAt: Date | null;
  bursaryAccountId: string | null;
}

const COMPLETED_UNDECIDED: AssessmentRow = {
  id: "asmt-1",
  applicationId: "app-1",
  status: "COMPLETED",
  outcome: null,
  assignedToId: "assessor-1",
  closedAt: null,
  bursaryAccountId: "acct-1",
};

function makeFakeTx(row: AssessmentRow | null = COMPLETED_UNDECIDED) {
  return {
    assessment: {
      findUnique: vi.fn(async () =>
        row
          ? {
              id: row.id,
              applicationId: row.applicationId,
              status: row.status,
              outcome: row.outcome,
              application: {
                assignedToId: row.assignedToId,
                closedAt: row.closedAt,
                bursaryAccountId: row.bursaryAccountId,
                round: { academicYear: "2026/27" },
              },
            }
          : null
      ),
      update: vi.fn(async () => ({})),
    },
    recommendation: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}

const asAdmin = () => {
  currentUser = {
    id: "admin-1",
    role: "ADMIN",
    email: "admin@example.test",
    firstName: "Al",
    lastName: "Admin",
  };
};
const asAssessor = (id: string) => {
  currentUser = {
    id,
    role: "ASSESSOR",
    email: `${id}@example.test`,
    firstName: "Ann",
    lastName: "Assessor",
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  asAdmin();
  fakeTx = makeFakeTx();
  reopenAccountMock.mockResolvedValue({
    scheduleEntryReopened: true,
    accountReopened: true,
  });
});

// ─── Who may reopen ───────────────────────────────────────────────────────────

describe("reopenAssessmentAction — authorisation", () => {
  it("allows an ADMIN who is not the assigned assessor", async () => {
    asAdmin();
    const res = await reopenAssessmentAction("asmt-1", "app-1");
    expect(res).toEqual({ success: true });
    expect(fakeTx.assessment.update).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: { status: "IN_PROGRESS", completedAt: null },
    });
  });

  it("allows the ASSIGNED assessor", async () => {
    asAssessor("assessor-1");
    const res = await reopenAssessmentAction("asmt-1", "app-1");
    expect(res).toEqual({ success: true });
    expect(fakeTx.assessment.update).toHaveBeenCalledTimes(1);
  });

  it("REFUSES another assessor, and writes nothing", async () => {
    asAssessor("assessor-2");
    const res = await reopenAssessmentAction("asmt-1", "app-1");
    expect(res).toEqual({ success: false, error: REOPEN_NOT_ASSIGNED_MESSAGE });
    expect(fakeTx.assessment.update).not.toHaveBeenCalled();
    expect(fakeTx.recommendation.updateMany).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("refuses when the assessment belongs to a different application", async () => {
    const res = await reopenAssessmentAction("asmt-1", "app-OTHER");
    expect(res.success).toBe(false);
    expect(fakeTx.assessment.update).not.toHaveBeenCalled();
  });
});

// ─── The gate: only until an outcome exists ───────────────────────────────────

describe("reopenAssessmentAction — the no-outcome gate (D13-2)", () => {
  it.each(["AWARDED", "QUALIFIES_NOT_AWARDED", "DOES_NOT_QUALIFY"])(
    "REFUSES once the outcome is %s, even for an ADMIN",
    async (outcome) => {
      fakeTx = makeFakeTx({ ...COMPLETED_UNDECIDED, outcome });
      const res = await reopenAssessmentAction("asmt-1", "app-1");
      expect(res).toEqual({
        success: false,
        error: REOPEN_OUTCOME_SET_MESSAGE,
      });
      expect(fakeTx.assessment.update).not.toHaveBeenCalled();
      expect(reopenAccountMock).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    }
  );

  it("refuses on a closed application", async () => {
    fakeTx = makeFakeTx({ ...COMPLETED_UNDECIDED, closedAt: new Date() });
    const res = await reopenAssessmentAction("asmt-1", "app-1");
    expect(res).toEqual({
      success: false,
      error: REOPEN_APPLICATION_CLOSED_MESSAGE,
    });
    expect(fakeTx.assessment.update).not.toHaveBeenCalled();
  });

  it.each(["NOT_STARTED", "IN_PROGRESS", "PAUSED"])(
    "refuses when the assessment is %s (nothing to reopen)",
    async (status) => {
      fakeTx = makeFakeTx({ ...COMPLETED_UNDECIDED, status });
      const res = await reopenAssessmentAction("asmt-1", "app-1");
      expect(res).toEqual({
        success: false,
        error: REOPEN_NOT_COMPLETED_MESSAGE,
      });
      expect(fakeTx.assessment.update).not.toHaveBeenCalled();
    }
  );
});

// ─── Side effects of a successful reopen ──────────────────────────────────────

describe("reopenAssessmentAction — side effects", () => {
  it("marks the recommendation stale so it must be re-confirmed", async () => {
    await reopenAssessmentAction("asmt-1", "app-1");
    expect(fakeTx.recommendation.updateMany).toHaveBeenCalledWith({
      where: { assessmentId: "asmt-1" },
      data: { confirmedPayableFees: null, gapAmount: null },
    });
  });

  it("reverts the close-on-complete account/schedule effects", async () => {
    await reopenAssessmentAction("asmt-1", "app-1");
    expect(reopenAccountMock).toHaveBeenCalledWith(fakeTx, {
      bursaryAccountId: "acct-1",
      academicYear: "2026/27",
    });
  });

  it("skips the account revert when the application has no bursary account", async () => {
    fakeTx = makeFakeTx({ ...COMPLETED_UNDECIDED, bursaryAccountId: null });
    const res = await reopenAssessmentAction("asmt-1", "app-1");
    expect(res).toEqual({ success: true });
    expect(reopenAccountMock).not.toHaveBeenCalled();
  });

  it("still reopens when the account revert fails (non-blocking, mirrors complete)", async () => {
    reopenAccountMock.mockRejectedValueOnce(new Error("schedule boom"));
    const res = await reopenAssessmentAction("asmt-1", "app-1");
    expect(res).toEqual({ success: true });
    expect(fakeTx.assessment.update).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("writes an ASSESSMENT_REOPENED audit row carrying what was reverted", async () => {
    await reopenAssessmentAction("asmt-1", "app-1", "  fees figure was wrong  ");
    expect(auditMock).toHaveBeenCalledTimes(1);
    const entry = auditMock.mock.calls[0][1] as {
      action: string;
      entityId: string;
      context: string;
      metadata: Record<string, unknown>;
    };
    expect(entry.action).toBe(AUDIT_ACTIONS.ASSESSMENT_REOPENED);
    expect(entry.entityId).toBe("asmt-1");
    expect(entry.context).toContain("fees figure was wrong");
    expect(entry.metadata).toMatchObject({
      applicationId: "app-1",
      assessmentId: "asmt-1",
      reason: "fees figure was wrong",
      recommendationCleared: true,
      accountReopened: true,
      scheduleEntryReopened: true,
    });
  });
});

// ─── The server-side completed lock ───────────────────────────────────────────

describe("saveAssessmentAction — server-side COMPLETED lock", () => {
  function makeSaveTx(status: string) {
    return {
      assessment: {
        findUnique: vi.fn(async () => ({ status })),
        update: vi.fn(async () => ({})),
        findUniqueOrThrow: vi.fn(async () => ({ status })),
      },
      recommendation: { updateMany: vi.fn(async () => ({ count: 0 })) },
    };
  }

  it("REJECTS a save against a COMPLETED assessment — the lock is not client-only", async () => {
    fakeTx = makeSaveTx("COMPLETED") as never;
    const res = await saveAssessmentAction("asmt-1", "app-1", {
      annualFees: 99999,
    } as never);
    expect(res).toEqual({
      success: false,
      error: ASSESSMENT_COMPLETED_LOCK_MESSAGE,
    });
    // The persistence layer is never reached: a completed assessment's snapshot
    // is what a recommendation was built on, so it must not be overwritten.
    expect(saveAssessment).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it.each(["NOT_STARTED", "IN_PROGRESS", "PAUSED"])(
    "still saves normally while %s",
    async (status) => {
      fakeTx = makeSaveTx(status) as never;
      const res = await saveAssessmentAction("asmt-1", "app-1", {
        annualFees: 1000,
      } as never);
      expect(res).toEqual({ success: true });
      expect(saveAssessment).toHaveBeenCalledTimes(1);
    }
  );

  it("rejects a save against an assessment that does not exist", async () => {
    fakeTx = {
      assessment: { findUnique: vi.fn(async () => null) },
    } as never;
    const res = await saveAssessmentAction("asmt-missing", "app-1", {} as never);
    expect(res).toEqual({ success: false, error: "Assessment not found." });
    expect(saveAssessment).not.toHaveBeenCalled();
  });
});
