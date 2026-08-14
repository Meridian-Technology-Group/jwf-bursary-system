import { describe, it, expect, vi } from "vitest";
import {
  isLegalFormTransition,
  isLegalAssessmentTransition,
  canSetOutcome,
  deriveReviewPhase,
  isDecided,
  lifecycleOutcomeForLegacy,
  requiredSectionCount,
  deriveFormStatusFromCounts,
  defaultPausedUntil,
  PAUSE_WINDOW_DAYS,
  pauseAssessmentRow,
  completeAssessmentRow,
  AssessmentSnapshotMissingError,
  assertSubmittedAtUnset,
  SUBMITTED_AT_IMMUTABLE_MESSAGE,
  discardAssessment,
  reopenAssessmentRow,
  reopenAssessmentForMaterialChange,
  refreshFormStatus,
  beginReview,
  resumeReview,
} from "../status";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { CURRENT_CALCULATION_VERSION } from "@/lib/assessment/engine-version";

describe("status service — review-phase derivation (PR-6a)", () => {
  it("projects the lifecycle columns onto the 7-value review phase (backfill table)", () => {
    // form not submitted → PRE_SUBMISSION
    expect(
      deriveReviewPhase({
        formStatus: "IN_PROGRESS",
        assessmentStatus: null,
        outcome: null,
        closedAt: null,
      })
    ).toBe("PRE_SUBMISSION");
    // submitted, no assessment / NOT_STARTED → SUBMITTED (awaiting review)
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: null,
        outcome: null,
        closedAt: null,
      })
    ).toBe("SUBMITTED");
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "NOT_STARTED",
        outcome: null,
        closedAt: null,
      })
    ).toBe("SUBMITTED");
    // assessment IN_PROGRESS → NOT_STARTED (review in progress)
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "IN_PROGRESS",
        outcome: null,
        closedAt: null,
      })
    ).toBe("NOT_STARTED");
    // assessment PAUSED → PAUSED
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "PAUSED",
        outcome: null,
        closedAt: null,
      })
    ).toBe("PAUSED");
    // assessment COMPLETED, no outcome → COMPLETED
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: null,
        closedAt: null,
      })
    ).toBe("COMPLETED");
    // outcomes → QUALIFIES / DOES_NOT_QUALIFY
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: "AWARDED",
        closedAt: null,
      })
    ).toBe("QUALIFIES");
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: "QUALIFIES_NOT_AWARDED",
        closedAt: null,
      })
    ).toBe("QUALIFIES");
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: "DOES_NOT_QUALIFY",
        closedAt: null,
      })
    ).toBe("DOES_NOT_QUALIFY");
  });

  it("isDecided is true exactly when an outcome is present", () => {
    expect(isDecided(null)).toBe(false);
    expect(isDecided("AWARDED")).toBe(true);
    expect(isDecided("QUALIFIES_NOT_AWARDED")).toBe(true);
    expect(isDecided("DOES_NOT_QUALIFY")).toBe(true);
  });

  it("canSetOutcome only from a COMPLETED assessment", () => {
    expect(canSetOutcome("COMPLETED")).toBe(true);
    expect(canSetOutcome("IN_PROGRESS")).toBe(false);
    expect(canSetOutcome("PAUSED")).toBe(false);
    expect(canSetOutcome(null)).toBe(false);
  });
});

describe("status service — form lifecycle", () => {
  it("allows forward moves and pre-submission re-derivation", () => {
    expect(isLegalFormTransition("CREATED", "NOT_STARTED")).toBe(true);
    expect(isLegalFormTransition("NOT_STARTED", "IN_PROGRESS")).toBe(true);
    expect(isLegalFormTransition("IN_PROGRESS", "FILLED_IN")).toBe(true);
    expect(isLegalFormTransition("FILLED_IN", "SUBMITTED")).toBe(true);
    // derivation may move a draft backwards among pre-submission states
    expect(isLegalFormTransition("FILLED_IN", "IN_PROGRESS")).toBe(true);
    expect(isLegalFormTransition("IN_PROGRESS", "CREATED")).toBe(true);
  });

  it("treats SUBMITTED as terminal", () => {
    expect(isLegalFormTransition("SUBMITTED", "FILLED_IN")).toBe(false);
    expect(isLegalFormTransition("SUBMITTED", "IN_PROGRESS")).toBe(false);
    expect(isLegalFormTransition("SUBMITTED", "SUBMITTED")).toBe(true); // identity ok
  });

  it("refreshFormStatus NEVER demotes a SUBMITTED form (terminal-safe; the only SUBMITTED→IN_PROGRESS path is the explicit reopen writer)", async () => {
    // Even with zero complete sections (which would derive CREATED for a draft),
    // a SUBMITTED form short-circuits and is never written back.
    const update = vi.fn(async () => ({}));
    const tx = {
      application: {
        findUniqueOrThrow: vi.fn(async () => ({
          formStatus: "SUBMITTED",
          applicationType: "NEW",
        })),
        update,
      },
      applicationSection: { count: vi.fn(async () => 0) },
    };
    const result = await refreshFormStatus(tx as never, "app-1");
    expect(result).toBe("SUBMITTED");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("status service — assessment lifecycle (strict, PR-4)", () => {
  it("requires the IN_PROGRESS step (first save drives NOT_STARTED → IN_PROGRESS)", () => {
    expect(isLegalAssessmentTransition("NOT_STARTED", "IN_PROGRESS")).toBe(true);
    expect(isLegalAssessmentTransition("IN_PROGRESS", "PAUSED")).toBe(true);
    expect(isLegalAssessmentTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(isLegalAssessmentTransition("PAUSED", "IN_PROGRESS")).toBe(true);
    expect(isLegalAssessmentTransition("PAUSED", "COMPLETED")).toBe(true);
  });

  it("no longer advertises the direct NOT_STARTED → {PAUSED, COMPLETED} jumps", () => {
    // PR-4 tightened these. The row helpers still tolerate a NOT_STARTED source
    // as a defensive fallback, but the table itself rejects them.
    expect(isLegalAssessmentTransition("NOT_STARTED", "PAUSED")).toBe(false);
    expect(isLegalAssessmentTransition("NOT_STARTED", "COMPLETED")).toBe(false);
  });

  it("opens exactly one exit edge from COMPLETED — the C1 reopen (D13-2)", () => {
    // Epic 13 / C1: COMPLETED was terminal; it now has a single exit edge so a
    // completed-by-mistake assessment can be corrected. IN_PROGRESS only.
    expect(isLegalAssessmentTransition("COMPLETED", "IN_PROGRESS")).toBe(true);
    expect(isLegalAssessmentTransition("COMPLETED", "PAUSED")).toBe(false);
  });

  it("allows the discard edges IN_PROGRESS/PAUSED → NOT_STARTED (D-G6/D3)", () => {
    expect(isLegalAssessmentTransition("IN_PROGRESS", "NOT_STARTED")).toBe(true);
    expect(isLegalAssessmentTransition("PAUSED", "NOT_STARTED")).toBe(true);
  });

  it("does NOT allow COMPLETED → NOT_STARTED (no auto-invalidation of a finished assessment)", () => {
    // Still false after C1: reopen preserves the assessment's data (→
    // IN_PROGRESS); discarding a completed assessment remains illegal.
    expect(isLegalAssessmentTransition("COMPLETED", "NOT_STARTED")).toBe(false);
  });
});

describe("status service — reopenAssessmentRow (Epic 13 / C1)", () => {
  function makeTx() {
    return {
      assessment: { update: vi.fn(async (_args: unknown) => ({})) },
    };
  }

  it("moves COMPLETED → IN_PROGRESS and clears completedAt", async () => {
    const tx = makeTx();
    await reopenAssessmentRow(tx as never, "asmt-1", "COMPLETED");
    expect(tx.assessment.update).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: { status: "IN_PROGRESS", completedAt: null },
    });
  });

  it("preserves the assessment's data — reopen is not discard", async () => {
    const tx = makeTx();
    await reopenAssessmentRow(tx as never, "asmt-1", "COMPLETED");
    const { data } = tx.assessment.update.mock.calls[0]![0] as unknown as {
      data: Record<string, unknown>;
    };
    // Only the two status fields are touched: no outcome reset, no snapshot
    // clearing. Correcting an assessment must not throw its figures away.
    expect(Object.keys(data).sort()).toEqual(["completedAt", "status"]);
  });

  it.each(["NOT_STARTED", "IN_PROGRESS", "PAUSED"] as const)(
    "throws (never silently no-ops) when the source is %s",
    async (from) => {
      const tx = makeTx();
      await expect(
        reopenAssessmentRow(tx as never, "asmt-1", from)
      ).rejects.toThrow(/not completed/i);
      expect(tx.assessment.update).not.toHaveBeenCalled();
    }
  );
});

describe("status service — legacy outcome shim", () => {
  it("derives the lifecycle outcome from account presence (PR-2 D-note)", () => {
    expect(lifecycleOutcomeForLegacy("QUALIFIES", true)).toBe("AWARDED");
    expect(lifecycleOutcomeForLegacy("QUALIFIES", false)).toBe(
      "QUALIFIES_NOT_AWARDED"
    );
    expect(lifecycleOutcomeForLegacy("DOES_NOT_QUALIFY", true)).toBe(
      "DOES_NOT_QUALIFY"
    );
    expect(lifecycleOutcomeForLegacy("DOES_NOT_QUALIFY", false)).toBe(
      "DOES_NOT_QUALIFY"
    );
  });
});

describe("status service — form-status derivation (matches the backfill)", () => {
  it("requires 10 sections for NEW, 9 for ROLLING_OVER", () => {
    expect(requiredSectionCount("NEW")).toBe(10);
    expect(requiredSectionCount("ROLLING_OVER")).toBe(9);
  });

  it("CREATED at 0 complete, IN_PROGRESS in between, FILLED_IN at/above required (NEW)", () => {
    expect(deriveFormStatusFromCounts(0, "NEW")).toBe("CREATED");
    expect(deriveFormStatusFromCounts(1, "NEW")).toBe("IN_PROGRESS");
    expect(deriveFormStatusFromCounts(9, "NEW")).toBe("IN_PROGRESS");
    expect(deriveFormStatusFromCounts(10, "NEW")).toBe("FILLED_IN");
    expect(deriveFormStatusFromCounts(11, "NEW")).toBe("FILLED_IN");
  });

  it("uses the lower threshold for ROLLING_OVER", () => {
    expect(deriveFormStatusFromCounts(0, "ROLLING_OVER")).toBe("CREATED");
    expect(deriveFormStatusFromCounts(8, "ROLLING_OVER")).toBe("IN_PROGRESS");
    expect(deriveFormStatusFromCounts(9, "ROLLING_OVER")).toBe("FILLED_IN");
  });
});

describe("status service — pause deadline", () => {
  it("defaults to now + PAUSE_WINDOW_DAYS", () => {
    const from = new Date("2026-06-05T00:00:00.000Z");
    const due = defaultPausedUntil(from);
    const expected = new Date(from);
    expected.setDate(expected.getDate() + PAUSE_WINDOW_DAYS);
    expect(due.toISOString()).toBe(expected.toISOString());
    expect(PAUSE_WINDOW_DAYS).toBe(14);
  });

  it("pauseAssessmentRow persists a caller-supplied deadline (assessor-set window)", async () => {
    const update = vi.fn(async () => undefined);
    const tx = { assessment: { update } } as never;
    const chosen = new Date("2026-06-16T00:00:00.000Z");

    const returned = await pauseAssessmentRow(
      tx,
      "asmt-1",
      "IN_PROGRESS",
      chosen
    );

    expect(returned).toBe(chosen);
    expect(update).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: { status: "PAUSED", pausedUntil: chosen },
    });
  });

  it("pauseAssessmentRow falls back to the default window when no deadline is given", async () => {
    const update = vi.fn(async () => undefined);
    const tx = { assessment: { update } } as never;

    const returned = await pauseAssessmentRow(tx, "asmt-1", "IN_PROGRESS");

    // The default is ~now + PAUSE_WINDOW_DAYS; assert it is in the future and the
    // same value was persisted (single source of truth for the email).
    expect(returned.getTime()).toBeGreaterThan(Date.now());
    expect(update).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: { status: "PAUSED", pausedUntil: returned },
    });
  });
});

describe("status service — write-once submitted_at invariant (PR-5)", () => {
  it("allows a first submission (submittedAt unset)", () => {
    // The submit path calls this BEFORE setting submittedAt; null/undefined pass.
    expect(() => assertSubmittedAtUnset(null)).not.toThrow();
    expect(() => assertSubmittedAtUnset(undefined)).not.toThrow();
  });

  it("rejects a second submission (submittedAt already set) with a friendly message", () => {
    // Proves the app-level invariant: an application that already has a fixed
    // submission date cannot be re-submitted / have submitted_at rewritten.
    // This is the nice message ahead of the durable DB trigger backstop.
    const alreadySubmitted = new Date("2026-06-01T09:00:00.000Z");
    expect(() => assertSubmittedAtUnset(alreadySubmitted)).toThrowError(
      SUBMITTED_AT_IMMUTABLE_MESSAGE
    );
  });

  it("treats the Unix epoch (a real, truthy date) as already submitted", () => {
    // Guard against a falsy-Date bug: new Date(0) is a valid submission instant.
    expect(() => assertSubmittedAtUnset(new Date(0))).toThrowError(
      SUBMITTED_AT_IMMUTABLE_MESSAGE
    );
  });
});

describe("status service — discardAssessment (D-G6/D3 invalidation primitive)", () => {
  /** Fake tx exposing the assessment + auditLog surfaces discardAssessment uses. */
  function makeTx(assessment: { id: string; status: string } | null) {
    return {
      assessment: {
        findUnique: vi.fn(async () => assessment),
        update: vi.fn(async () => ({})),
      },
      auditLog: { create: vi.fn(async (..._args: unknown[]) => ({})) },
    };
  }

  it("resets an IN_PROGRESS assessment to NOT_STARTED, clearing outcome/completedAt/pausedUntil", async () => {
    const tx = makeTx({ id: "asmt-1", status: "IN_PROGRESS" });
    const discarded = await discardAssessment(tx as never, "app-1", "assessor-1", {
      reason: "on-behalf edit",
      changedFields: ["parent1Income.salary"],
    });

    expect(discarded).toBe(true);
    expect(tx.assessment.update).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: {
        status: "NOT_STARTED",
        outcome: null,
        completedAt: null,
        pausedUntil: null,
      },
    });
  });

  it("discards a PAUSED assessment too", async () => {
    const tx = makeTx({ id: "asmt-2", status: "PAUSED" });
    const discarded = await discardAssessment(tx as never, "app-1", "assessor-1", {
      reason: "on-behalf edit",
    });
    expect(discarded).toBe(true);
    expect(tx.assessment.update).toHaveBeenCalledTimes(1);
  });

  it("writes ASSESSMENT_DISCARDED with { applicationId, reason, changedFields } on the assessment row", async () => {
    const tx = makeTx({ id: "asmt-1", status: "IN_PROGRESS" });
    await discardAssessment(tx as never, "app-1", "assessor-1", {
      reason: "on-behalf edit",
      changedFields: ["a", "b"],
    });

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const arg = tx.auditLog.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      userId: "assessor-1",
      action: AUDIT_ACTIONS.ASSESSMENT_DISCARDED,
      entityType: AUDIT_ENTITY_TYPES.Assessment,
      entityId: "asmt-1",
    });
    expect(arg.data.metadata).toMatchObject({
      applicationId: "app-1",
      reason: "on-behalf edit",
      changedFields: ["a", "b"],
      fromStatus: "IN_PROGRESS",
    });
  });

  it("is a no-op (no write, no audit) when already NOT_STARTED", async () => {
    const tx = makeTx({ id: "asmt-1", status: "NOT_STARTED" });
    const discarded = await discardAssessment(tx as never, "app-1", "assessor-1", {
      reason: "x",
    });
    expect(discarded).toBe(false);
    expect(tx.assessment.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("is a no-op when there is no assessment row", async () => {
    const tx = makeTx(null);
    const discarded = await discardAssessment(tx as never, "app-1", "assessor-1", {
      reason: "x",
    });
    expect(discarded).toBe(false);
    expect(tx.assessment.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("does NOT discard a COMPLETED assessment via this path (no auto-invalidation)", async () => {
    const tx = makeTx({ id: "asmt-1", status: "COMPLETED" });
    const discarded = await discardAssessment(tx as never, "app-1", "assessor-1", {
      reason: "x",
    });
    expect(discarded).toBe(false);
    expect(tx.assessment.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("status service — ensureAssessmentRow via beginReview/resumeReview (CALC-14)", () => {
  /**
   * Fake tx exposing the assessment surface `ensureAssessmentRow` +
   * `beginReview`/`resumeReview` use. Mirrors the `discardAssessment` fake tx
   * above but adds `create` since these paths (unlike `discardAssessment`) can
   * create the row.
   */
  function makeTx(existing: { id: string; status: string } | null) {
    return {
      assessment: {
        findUnique: vi.fn(async () => existing),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: "asmt-new",
          status: args.data.status,
        })),
        update: vi.fn(async () => ({})),
      },
    };
  }

  it("beginReview creates a new assessment row stamped with CURRENT_CALCULATION_VERSION (not the schema's v1 default)", async () => {
    const tx = makeTx(null);
    const id = await beginReview(tx as never, "app-1", "assessor-1");

    expect(id).toBe("asmt-new");
    expect(tx.assessment.create).toHaveBeenCalledTimes(1);
    const arg = tx.assessment.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      applicationId: "app-1",
      assessorId: "assessor-1",
      calculationVersion: CURRENT_CALCULATION_VERSION,
    });
    expect(arg.data.calculationVersion).toBe(2);
  });

  it("resumeReview also creates via the same v2-stamped path when no row exists yet", async () => {
    const tx = makeTx(null);
    await resumeReview(tx as never, "app-1", "assessor-1");

    expect(tx.assessment.create).toHaveBeenCalledTimes(1);
    const arg = tx.assessment.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.calculationVersion).toBe(CURRENT_CALCULATION_VERSION);
  });

  it("does NOT re-create (or re-stamp) an existing assessment row", async () => {
    const tx = makeTx({ id: "asmt-existing", status: "NOT_STARTED" });
    const id = await beginReview(tx as never, "app-1", "assessor-1");

    expect(id).toBe("asmt-existing");
    expect(tx.assessment.create).not.toHaveBeenCalled();
  });
});

describe("status service — reopenAssessmentForMaterialChange (soft send-back)", () => {
  function makeTx(
    formStatus: string,
    assessment: { id: string; status: string } | null
  ) {
    return {
      application: {
        findUniqueOrThrow: vi.fn(async () => ({ formStatus })),
        update: vi.fn(async () => ({})),
      },
      assessment: {
        findUnique: vi.fn(async () => assessment),
        update: vi.fn(async () => ({})),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    };
  }

  it("moves a SUBMITTED form → IN_PROGRESS and discards the live assessment, keeping data", async () => {
    const tx = makeTx("SUBMITTED", { id: "asmt-1", status: "IN_PROGRESS" });
    const res = await reopenAssessmentForMaterialChange(
      tx as never,
      "app-1",
      "assessor-1",
      "correcting income"
    );

    expect(res).toEqual({ formStatus: "IN_PROGRESS", assessmentDiscarded: true });
    // Form demoted via the explicit writer (NOT a section delete).
    expect(tx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { formStatus: "IN_PROGRESS" },
    });
    // Assessment reset in the SAME tx.
    expect(tx.assessment.update).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: {
        status: "NOT_STARTED",
        outcome: null,
        completedAt: null,
        pausedUntil: null,
      },
    });
  });

  it("throws when the form is not SUBMITTED (terminal-safety: only this writer demotes)", async () => {
    const tx = makeTx("IN_PROGRESS", null);
    await expect(
      reopenAssessmentForMaterialChange(tx as never, "app-1", "assessor-1", "x")
    ).rejects.toThrow(/not submitted/i);
    expect(tx.application.update).not.toHaveBeenCalled();
  });

  it("reopens even with no assessment row (assessmentDiscarded = false)", async () => {
    const tx = makeTx("SUBMITTED", null);
    const res = await reopenAssessmentForMaterialChange(
      tx as never,
      "app-1",
      "assessor-1",
      "x"
    );
    expect(res).toEqual({ formStatus: "IN_PROGRESS", assessmentDiscarded: false });
    expect(tx.application.update).toHaveBeenCalledTimes(1);
  });
});

// ─── Item 2: CLOSED phase precedence ─────────────────────────────────────────

import { deriveReviewPhase as derive } from "../status";

describe("deriveReviewPhase — CLOSED (item 2)", () => {
  const closedAt = new Date("2026-07-01T00:00:00Z");

  it("closedAt wins over every other lifecycle state", () => {
    expect(
      derive({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: "AWARDED",
        closedAt,
      })
    ).toBe("CLOSED");
    expect(
      derive({
        formStatus: "IN_PROGRESS",
        assessmentStatus: null,
        outcome: null,
        closedAt,
      })
    ).toBe("CLOSED");
    expect(
      derive({
        formStatus: "SUBMITTED",
        assessmentStatus: "PAUSED",
        outcome: null,
        closedAt,
      })
    ).toBe("CLOSED");
  });

  it("null closedAt leaves the existing mapping untouched", () => {
    expect(
      derive({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: "AWARDED",
        closedAt: null,
      })
    ).toBe("QUALIFIES");
  });
});

// ─── CALC-15: completeAssessmentRow — v2 snapshot guard ──────────────────────

describe("completeAssessmentRow — v2 snapshot guard (CALC-15)", () => {
  /**
   * Fake tx exposing the assessment surface `completeAssessmentRow` uses: the
   * pre-flight snapshot read (`findUniqueOrThrow`) and the status-flip write.
   */
  function makeTx(snapshot: {
    calculationVersion: number;
    totalHouseholdNetIncome: number | null;
  }) {
    return {
      assessment: {
        findUniqueOrThrow: vi.fn(async () => snapshot),
        update: vi.fn(async () => ({})),
      },
    };
  }

  it("REJECTS completing a v2 assessment whose snapshot was never saved (null totalHouseholdNetIncome)", async () => {
    const tx = makeTx({
      calculationVersion: CURRENT_CALCULATION_VERSION,
      totalHouseholdNetIncome: null,
    });

    await expect(
      completeAssessmentRow(tx as never, "asmt-1", "IN_PROGRESS")
    ).rejects.toBeInstanceOf(AssessmentSnapshotMissingError);
    expect(tx.assessment.update).not.toHaveBeenCalled();
  });

  it("ALLOWS completing a v2 assessment with a persisted snapshot", async () => {
    const tx = makeTx({
      calculationVersion: CURRENT_CALCULATION_VERSION,
      totalHouseholdNetIncome: 45000,
    });

    await completeAssessmentRow(tx as never, "asmt-1", "IN_PROGRESS");
    expect(tx.assessment.update).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
  });

  it("does NOT guard a v1 assessment (calculationVersion 1) even with a null total", async () => {
    const tx = makeTx({ calculationVersion: 1, totalHouseholdNetIncome: null });

    await completeAssessmentRow(tx as never, "asmt-1", "IN_PROGRESS");
    expect(tx.assessment.update).toHaveBeenCalledTimes(1);
  });

  it("still tolerates a NOT_STARTED source (pre-existing behaviour) when the v2 snapshot IS present", async () => {
    const tx = makeTx({
      calculationVersion: CURRENT_CALCULATION_VERSION,
      totalHouseholdNetIncome: 12000,
    });

    await completeAssessmentRow(tx as never, "asmt-1", "NOT_STARTED");
    expect(tx.assessment.update).toHaveBeenCalledTimes(1);
  });
});
