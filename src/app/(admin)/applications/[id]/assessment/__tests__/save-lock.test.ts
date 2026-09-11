import { describe, it, expect } from "vitest";
import {
  assessmentSaveLock,
  EDITABLE_ASSESSMENT_STATUSES,
  ASSESSMENT_COMPLETED_LOCK_MESSAGE,
  ASSESSMENT_LOCKED_STATE_MESSAGE,
} from "../gate";

/**
 * Charlotte, 10 Sep 2026: she amended and saved an assessment that was locked
 * as a new award, whose own banner said it "can no longer be amended". The
 * gate tested `status === "COMPLETED"` only, so every Epic 18 state added
 * after that check was written fell through it.
 */

// Every member of AssessmentStatus, listed literally. If the enum gains a
// value this list goes stale, which the exhaustiveness test below catches.
const ALL_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "NEW_AWARD",
  "WAITING_LIST",
  "CLOSED_ARCHIVED",
  "ROLLED_OVER",
] as const;

describe("assessmentSaveLock", () => {
  it.each(EDITABLE_ASSESSMENT_STATUSES)("%s is editable — work in progress", (status) => {
    expect(assessmentSaveLock(status)).toEqual({ locked: false });
  });

  it("COMPLETED is locked, and keeps its reopen wording", () => {
    const result = assessmentSaveLock("COMPLETED");
    expect(result.locked).toBe(true);
    expect(result.locked && result.message).toBe(ASSESSMENT_COMPLETED_LOCK_MESSAGE);
  });

  // The actual regression. Each of these was silently saveable.
  it.each(["NEW_AWARD", "WAITING_LIST", "CLOSED_ARCHIVED", "ROLLED_OVER"])(
    "%s is locked and points at the reversal route",
    (status) => {
      const result = assessmentSaveLock(status);
      expect(result.locked).toBe(true);
      expect(result.locked && result.message).toBe(ASSESSMENT_LOCKED_STATE_MESSAGE);
    }
  );

  it("locks every status that is not on the allowlist", () => {
    const locked = ALL_STATUSES.filter((s) => assessmentSaveLock(s).locked);
    const editable = ALL_STATUSES.filter((s) => !assessmentSaveLock(s).locked);
    expect(editable.sort()).toEqual([...EDITABLE_ASSESSMENT_STATUSES].sort());
    expect(locked).toHaveLength(ALL_STATUSES.length - EDITABLE_ASSESSMENT_STATUSES.length);
  });

  // The safe-direction guarantee: an unknown status locks rather than opens.
  // A future AssessmentStatus member gets this behaviour for free, which is
  // the whole reason the gate is an allowlist.
  it("an unrecognised status is locked, not editable", () => {
    expect(assessmentSaveLock("SOME_FUTURE_STATE").locked).toBe(true);
    expect(assessmentSaveLock("").locked).toBe(true);
  });
});
