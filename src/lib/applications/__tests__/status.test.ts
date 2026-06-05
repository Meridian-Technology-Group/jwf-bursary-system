import { describe, it, expect } from "vitest";
import {
  isLegalApplicationTransition,
  isLegalFormTransition,
  isLegalAssessmentTransition,
  canSetOutcome,
  legacyStatusForOutcome,
  lifecycleOutcomeForLegacy,
  requiredSectionCount,
  deriveFormStatusFromCounts,
  defaultPausedUntil,
  PAUSE_WINDOW_DAYS,
} from "../status";

describe("status service — legacy application transitions", () => {
  it("preserves the pre-PR-3 graph exactly", () => {
    expect(isLegalApplicationTransition("SUBMITTED", "NOT_STARTED")).toBe(true);
    expect(isLegalApplicationTransition("NOT_STARTED", "PAUSED")).toBe(true);
    expect(isLegalApplicationTransition("NOT_STARTED", "COMPLETED")).toBe(true);
    expect(isLegalApplicationTransition("PAUSED", "NOT_STARTED")).toBe(true);
    expect(isLegalApplicationTransition("COMPLETED", "QUALIFIES")).toBe(true);
    expect(isLegalApplicationTransition("COMPLETED", "DOES_NOT_QUALIFY")).toBe(
      true
    );
  });

  it("rejects moves outside the graph", () => {
    expect(isLegalApplicationTransition("SUBMITTED", "COMPLETED")).toBe(false);
    expect(isLegalApplicationTransition("PRE_SUBMISSION", "SUBMITTED")).toBe(
      false // owned by the applicant submit path, not this graph
    );
    expect(isLegalApplicationTransition("COMPLETED", "PAUSED")).toBe(false);
    expect(isLegalApplicationTransition("QUALIFIES", "COMPLETED")).toBe(false);
  });

  it("canSetOutcome only from COMPLETED", () => {
    expect(canSetOutcome("COMPLETED")).toBe(true);
    expect(canSetOutcome("NOT_STARTED")).toBe(false);
    expect(canSetOutcome("PAUSED")).toBe(false);
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

describe("status service — outcome ↔ legacy mirror", () => {
  it("maps the 3-value outcome back onto the legacy fused status", () => {
    expect(legacyStatusForOutcome("AWARDED")).toBe("QUALIFIES");
    expect(legacyStatusForOutcome("QUALIFIES_NOT_AWARDED")).toBe("QUALIFIES");
    expect(legacyStatusForOutcome("DOES_NOT_QUALIFY")).toBe("DOES_NOT_QUALIFY");
  });

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
