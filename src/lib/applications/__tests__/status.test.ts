import { describe, it, expect } from "vitest";
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
  assertSubmittedAtUnset,
  SUBMITTED_AT_IMMUTABLE_MESSAGE,
} from "../status";

describe("status service — review-phase derivation (PR-6a)", () => {
  it("projects the lifecycle columns onto the 7-value review phase (backfill table)", () => {
    // form not submitted → PRE_SUBMISSION
    expect(
      deriveReviewPhase({
        formStatus: "IN_PROGRESS",
        assessmentStatus: null,
        outcome: null,
      })
    ).toBe("PRE_SUBMISSION");
    // submitted, no assessment / NOT_STARTED → SUBMITTED (awaiting review)
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: null,
        outcome: null,
      })
    ).toBe("SUBMITTED");
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "NOT_STARTED",
        outcome: null,
      })
    ).toBe("SUBMITTED");
    // assessment IN_PROGRESS → NOT_STARTED (review in progress)
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "IN_PROGRESS",
        outcome: null,
      })
    ).toBe("NOT_STARTED");
    // assessment PAUSED → PAUSED
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "PAUSED",
        outcome: null,
      })
    ).toBe("PAUSED");
    // assessment COMPLETED, no outcome → COMPLETED
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: null,
      })
    ).toBe("COMPLETED");
    // outcomes → QUALIFIES / DOES_NOT_QUALIFY
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: "AWARDED",
      })
    ).toBe("QUALIFIES");
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: "QUALIFIES_NOT_AWARDED",
      })
    ).toBe("QUALIFIES");
    expect(
      deriveReviewPhase({
        formStatus: "SUBMITTED",
        assessmentStatus: "COMPLETED",
        outcome: "DOES_NOT_QUALIFY",
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

  it("treats COMPLETED as terminal", () => {
    expect(isLegalAssessmentTransition("COMPLETED", "PAUSED")).toBe(false);
    expect(isLegalAssessmentTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
  });
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
