import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Epic 18 — the post-assessment core authenticates, runs one `withUserContext`
// transaction (gates, promotion at NEW_AWARD, the status write, the audit) and
// then a `withAdminContext` schedule mirror for NEW_AWARD. We mock those
// boundaries and pass a fake Prisma `tx` through, so the Epic 18 invariants
// are assertable:
//   - NEW_AWARD → exactly one BursaryAccount create (idempotent), the status
//     write, one lifecycle audit row — and NO email (this module cannot even
//     send one; Q11 made silence the design).
//   - WAITING_LIST / CLOSED_ARCHIVED → no account, status write, audit row.
//   - illegal source status → rejected, no writes.
//   - the v2 re-confirmation gate applies to NEW_AWARD only.
//   - revert → back to COMPLETED, account untouched.

vi.mock("@/lib/auth/roles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/roles")>(
    "@/lib/auth/roles"
  );
  return {
    ...actual,
    requireRole: vi.fn(async () => ({
      id: "assessor-1",
      role: "ASSESSOR",
      email: "assessor@example.test",
      firstName: "Ada",
      lastName: "Assessor",
    })),
  };
});

const mirrorMock = vi.fn(async (..._args: unknown[]) => ({}));
vi.mock("@/lib/bursary-accounts/lifecycle", () => ({
  mirrorApplicationToSchedule: (...args: unknown[]) => mirrorMock(...args),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (
    _userId: string,
    _role: string,
    fn: (tx: unknown) => unknown
  ) => fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import {
  setPostAssessmentFinalState,
  revertPostAssessmentState,
} from "../post-assessment-core";
import { RECOMMENDATION_NOT_RECONFIRMED_MESSAGE } from "../recommendation-gate";

// ─── Fake Prisma transaction client ───────────────────────────────────────────

function makeFakeTx(application: Record<string, unknown>) {
  // The post-transaction schedule-mirror block refetches the application; in
  // production the promotion has set `bursaryAccountId` by then, so the fake
  // reflects the write once the account create has happened.
  const tx = {
    application: {
      findUnique: vi.fn(async () =>
        tx.bursaryAccount.create.mock.calls.length > 0
          ? { ...application, bursaryAccountId: "account-1" }
          : application
      ),
      update: vi.fn(async () => ({})),
    },
    bursaryAccount: {
      create: vi.fn(async () => ({
        id: "account-1",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2026/2027",
      })),
      findUnique: vi.fn(async () => ({
        id: "existing-account",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2026/2027",
        status: "ACTIVE",
      })),
      update: vi.fn(async () => ({})),
    },
    bursaryScheduleEntry: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
    },
    assessment: {
      update: vi.fn(async () => ({})),
    },
    closeReason: {
      findUnique: vi.fn(async () => ({ id: "close-reason-1", isDeprecated: false })),
    },
    auditLog: {
      create: vi.fn(
        async (_args: {
          data: { action: string; metadata: Record<string, unknown> };
        }) => ({})
      ),
    },
  };
  return tx;
}

function baseApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    reference: "Child – Whitgift School – Year 7 – 2026-27",
    childName: "Child Name",
    childDob: new Date("2014-01-01"),
    entryYear: 2026,
    entryYearGroup: "Y7",
    school: "WHITGIFT",
    bursaryAccountId: null,
    applicationType: "NEW",
    archivedAt: null,
    roundId: "round-1",
    leadApplicantId: "lead-1",
    round: {
      academicYear: "2026/2027",
      openDate: new Date("2026-09-01"),
      closeDate: new Date("2026-12-01"),
    },
    assessment: {
      id: "assess-1",
      status: "COMPLETED",
      outcome: null,
      calculationVersion: 2,
      assessmentSchool: null,
      yearlyPayableFees: null,
      recommendedPayableFees: 12_000,
      recommendation: { confirmedPayableFees: 11_500 },
    },
    ...overrides,
  };
}

function withAssessment(overrides: Record<string, unknown>) {
  const app = baseApplication();
  return {
    ...app,
    assessment: { ...(app.assessment as Record<string, unknown>), ...overrides },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setPostAssessmentFinalState — NEW_AWARD", () => {
  it("creates the account, writes the status, audits — and has no email to send", async () => {
    fakeTx = makeFakeTx(baseApplication());
    const result = await setPostAssessmentFinalState("app-1", "NEW_AWARD", { awardFundType: "JWF" });

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).toHaveBeenCalledTimes(1);
    expect(fakeTx.assessment.update).toHaveBeenCalledWith({
      where: { id: "assess-1" },
      data: { status: "NEW_AWARD" },
    });
    const auditActions = fakeTx.auditLog.create.mock.calls.map((c) => c[0].data.action);
    expect(auditActions).toContain("ASSESSMENT_LIFECYCLE_SET");
    // CH-49 — the schedule mirror runs now that the account exists.
    expect(mirrorMock).toHaveBeenCalledTimes(1);
  });

  it("Q14 — an amended reference is applied and audited in the same transaction", async () => {
    fakeTx = makeFakeTx(baseApplication());
    const result = await setPostAssessmentFinalState("app-1", "NEW_AWARD", {
      amendedReference: "WS-202627-0042",
      awardFundType: "WSP_JWF",
    });

    expect(result).toEqual({ success: true });
    expect(fakeTx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reference: "WS-202627-0042" } })
    );
    const auditActions = fakeTx.auditLog.create.mock.calls.map((c) => c[0].data.action);
    expect(auditActions).toContain("UPDATE_REFERENCE");
  });

  it("Q14 — an unchanged or blank reference writes nothing", async () => {
    fakeTx = makeFakeTx(baseApplication());
    await setPostAssessmentFinalState("app-1", "NEW_AWARD", {
      amendedReference: "Child – Whitgift School – Year 7 – 2026-27",
      awardFundType: "JWF",
    });
    expect(fakeTx.application.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reference: expect.anything() }),
      })
    );
  });

  it("refuses a whitespace-only amended reference", async () => {
    fakeTx = makeFakeTx(baseApplication());
    const result = await setPostAssessmentFinalState("app-1", "NEW_AWARD", {
      amendedReference: "   ",
      awardFundType: "JWF",
    });
    // Blank-after-trim means "keep the current reference" — the lock proceeds.
    expect(result).toEqual({ success: true });
  });

  it("the v2 re-confirmation gate blocks an award off an unconfirmed recommendation", async () => {
    fakeTx = makeFakeTx(
      withAssessment({ recommendation: { confirmedPayableFees: null } })
    );
    const result = await setPostAssessmentFinalState("app-1", "NEW_AWARD", { awardFundType: "JWF" });
    expect(result).toEqual({
      success: false,
      error: RECOMMENDATION_NOT_RECONFIRMED_MESSAGE,
    });
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(fakeTx.assessment.update).not.toHaveBeenCalled();
  });

  it("is reachable from the waiting list (transition #6)", async () => {
    fakeTx = makeFakeTx(withAssessment({ status: "WAITING_LIST" }));
    const result = await setPostAssessmentFinalState("app-1", "NEW_AWARD", { awardFundType: "JWF" });
    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).toHaveBeenCalledTimes(1);
  });
});

describe("setPostAssessmentFinalState — WAITING_LIST / CLOSED_ARCHIVED", () => {
  it.each(["WAITING_LIST", "CLOSED_ARCHIVED"] as const)(
    "%s: status write and audit, no account, no mirror",
    async (target) => {
      fakeTx = makeFakeTx(baseApplication());
      const result = await setPostAssessmentFinalState("app-1", target, {
        closeReasonId: target === "CLOSED_ARCHIVED" ? "close-reason-1" : undefined,
      });

      expect(result).toEqual({ success: true });
      expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
      expect(mirrorMock).not.toHaveBeenCalled();
      expect(fakeTx.assessment.update).toHaveBeenCalledWith({
        where: { id: "assess-1" },
        data: { status: target },
      });
    }
  );

  it("the re-confirmation gate does NOT apply — parking a case decides nothing", async () => {
    fakeTx = makeFakeTx(
      withAssessment({ recommendation: { confirmedPayableFees: null } })
    );
    const result = await setPostAssessmentFinalState("app-1", "WAITING_LIST");
    expect(result).toEqual({ success: true });
  });
});

describe("setPostAssessmentFinalState — gates", () => {
  it.each(["NOT_STARTED", "IN_PROGRESS", "PAUSED"] as const)(
    "refuses from %s with no side effects",
    async (from) => {
      fakeTx = makeFakeTx(withAssessment({ status: from }));
      const result = await setPostAssessmentFinalState("app-1", "NEW_AWARD", { awardFundType: "JWF" });
      expect(result.success).toBe(false);
      expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
      expect(fakeTx.assessment.update).not.toHaveBeenCalled();
      expect(fakeTx.auditLog.create).not.toHaveBeenCalled();
    }
  );

  it("refuses NEW_AWARD → CLOSED_ARCHIVED (a locked award must be reversed first)", async () => {
    fakeTx = makeFakeTx(withAssessment({ status: "NEW_AWARD" }));
    const result = await setPostAssessmentFinalState("app-1", "CLOSED_ARCHIVED");
    expect(result.success).toBe(false);
    expect(fakeTx.assessment.update).not.toHaveBeenCalled();
  });
});

describe("revertPostAssessmentState", () => {
  it.each(["NEW_AWARD", "WAITING_LIST", "CLOSED_ARCHIVED"] as const)(
    "%s reverts to COMPLETED with one audit row",
    async (from) => {
      fakeTx = makeFakeTx(withAssessment({ status: from }));
      const result = await revertPostAssessmentState("app-1");

      expect(result).toEqual({ success: true });
      expect(fakeTx.assessment.update).toHaveBeenCalledWith({
        where: { id: "assess-1" },
        data: { status: "COMPLETED" },
      });
      const audit = fakeTx.auditLog.create.mock.calls[0][0];
      expect(audit.data.action).toBe("ASSESSMENT_LIFECYCLE_REVERTED");
      expect(audit.data.metadata.fromState).toBe(from);
    }
  );

  it("Q16 — a reversed NEW_AWARD leaves the bursary account untouched", async () => {
    fakeTx = makeFakeTx(
      withAssessment({ status: "NEW_AWARD" })
    );
    await revertPostAssessmentState("app-1");
    expect(fakeTx.bursaryAccount.update).not.toHaveBeenCalled();
    const audit = fakeTx.auditLog.create.mock.calls[0][0];
    expect(audit.data.metadata.accountRetained).toBe(true);
  });

  it("refuses when the assessment is not in a final state", async () => {
    fakeTx = makeFakeTx(baseApplication());
    const result = await revertPostAssessmentState("app-1");
    expect(result.success).toBe(false);
    expect(fakeTx.assessment.update).not.toHaveBeenCalled();
  });
});

// ─── Epic 18b — the rolling-over track, the fund, the close reason ───────────

function rollingApplication(assessmentOverrides: Record<string, unknown> = {}) {
  const app = baseApplication({
    applicationType: "ROLLING_OVER",
    bursaryAccountId: "existing-account",
  });
  return {
    ...app,
    assessment: { ...(app.assessment as Record<string, unknown>), ...assessmentOverrides },
  };
}

describe("Epic 18b — ROLLED_OVER lock", () => {
  it("locks a rolling-over assessment: continues the account, records the fund, no reference prompt", async () => {
    fakeTx = makeFakeTx(rollingApplication());
    const result = await setPostAssessmentFinalState("app-1", "ROLLED_OVER", {
      awardFundType: "JWF",
    });

    expect(result).toEqual({ success: true });
    // The account exists — the idempotent promotion CONTINUES it, never creates.
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(fakeTx.assessment.update).toHaveBeenCalledWith({
      where: { id: "assess-1" },
      data: { awardFundType: "JWF" },
    });
    expect(fakeTx.assessment.update).toHaveBeenCalledWith({
      where: { id: "assess-1" },
      data: { status: "ROLLED_OVER" },
    });
    // No reference amendment path on this track.
    expect(fakeTx.application.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reference: expect.anything() }),
      })
    );
  });

  it("refuses ROLLED_OVER on a NEW application, and NEW_AWARD on a rolling one", async () => {
    fakeTx = makeFakeTx(baseApplication());
    const wrongTrack = await setPostAssessmentFinalState("app-1", "ROLLED_OVER", {
      awardFundType: "JWF",
    });
    expect(wrongTrack.success).toBe(false);

    fakeTx = makeFakeTx(rollingApplication());
    const wrongLock = await setPostAssessmentFinalState("app-1", "NEW_AWARD", {
      awardFundType: "JWF",
    });
    expect(wrongLock.success).toBe(false);
    expect(fakeTx.assessment.update).not.toHaveBeenCalled();
  });

  it("the waiting list belongs to the new track only", async () => {
    fakeTx = makeFakeTx(rollingApplication());
    const result = await setPostAssessmentFinalState("app-1", "WAITING_LIST");
    expect(result.success).toBe(false);
  });

  it("reverts to COMPLETED like every other final state", async () => {
    fakeTx = makeFakeTx(rollingApplication({ status: "ROLLED_OVER" }));
    const result = await revertPostAssessmentState("app-1");
    expect(result).toEqual({ success: true });
    expect(fakeTx.assessment.update).toHaveBeenCalledWith({
      where: { id: "assess-1" },
      data: { status: "COMPLETED" },
    });
  });
});

describe("Epic 18b — the award fund", () => {
  it("both locks refuse without a fund", async () => {
    fakeTx = makeFakeTx(baseApplication());
    const noFundNew = await setPostAssessmentFinalState("app-1", "NEW_AWARD", {});
    expect(noFundNew).toEqual({
      success: false,
      error: "Select which fund pays this award before locking.",
    });

    fakeTx = makeFakeTx(rollingApplication());
    const noFundRolled = await setPostAssessmentFinalState("app-1", "ROLLED_OVER", {});
    expect(noFundRolled.success).toBe(false);
  });

  it("validates the fund against the assessed school (TBF is Trinity-only)", async () => {
    fakeTx = makeFakeTx(baseApplication()); // school WHITGIFT
    const result = await setPostAssessmentFinalState("app-1", "NEW_AWARD", {
      awardFundType: "TBF",
    });
    expect(result).toEqual({
      success: false,
      error: "TBF bursary is not offered at this school.",
    });
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
  });

  it("the assessor-picked assessment school wins over the application's", async () => {
    // Application says WHITGIFT, assessor assessed against TRINITY → TBF is legal.
    fakeTx = makeFakeTx(withAssessment({ assessmentSchool: "TRINITY" }));
    const result = await setPostAssessmentFinalState("app-1", "NEW_AWARD", {
      awardFundType: "TBF",
    });
    expect(result).toEqual({ success: true });
  });

  it("the audit row carries the fund", async () => {
    fakeTx = makeFakeTx(baseApplication());
    await setPostAssessmentFinalState("app-1", "NEW_AWARD", { awardFundType: "WFA" });
    const lifecycleRow = fakeTx.auditLog.create.mock.calls
      .map((c) => c[0].data)
      .find((d) => d.action === "ASSESSMENT_LIFECYCLE_SET");
    expect(lifecycleRow?.metadata.awardFundType).toBe("WFA");
  });
});

describe("Epic 18b — the archive close reason", () => {
  it("archiving without a reason is refused", async () => {
    fakeTx = makeFakeTx(baseApplication());
    const result = await setPostAssessmentFinalState("app-1", "CLOSED_ARCHIVED", {});
    expect(result).toEqual({
      success: false,
      error: "Select a close reason before archiving.",
    });
  });

  it("a deprecated or unknown reason is refused", async () => {
    fakeTx = makeFakeTx(baseApplication());
    fakeTx.closeReason.findUnique.mockResolvedValueOnce({
      id: "close-reason-1",
      isDeprecated: true,
    });
    const result = await setPostAssessmentFinalState("app-1", "CLOSED_ARCHIVED", {
      closeReasonId: "close-reason-1",
    });
    expect(result).toEqual({ success: false, error: "Close reason not found." });
  });

  it("the reason is stored on the assessment with the archive", async () => {
    fakeTx = makeFakeTx(baseApplication());
    await setPostAssessmentFinalState("app-1", "CLOSED_ARCHIVED", {
      closeReasonId: "close-reason-1",
    });
    expect(fakeTx.assessment.update).toHaveBeenCalledWith({
      where: { id: "assess-1" },
      data: { archiveCloseReasonId: "close-reason-1" },
    });
  });
});
