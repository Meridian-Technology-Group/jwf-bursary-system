import { describe, expect, it } from "vitest";
import type { AssessmentOutcome, AssessmentStatus } from "@prisma/client";
import { deriveAssessmentLifecycleState } from "../lifecycle-state";

const CLOSED = new Date("2026-08-01T00:00:00.000Z");

function derive(
  assessmentStatus: AssessmentStatus | null,
  outcome: AssessmentOutcome | null = null,
  closedAt: Date | null = null
) {
  return deriveAssessmentLifecycleState({ assessmentStatus, outcome, closedAt });
}

describe("deriveAssessmentLifecycleState (CH-05 four-state model, LA15-1)", () => {
  it("NOT STARTED: no assessment row, or an untouched one", () => {
    expect(derive(null)).toBe("NOT_STARTED");
    expect(derive("NOT_STARTED")).toBe("NOT_STARTED");
  });

  it("PAUSED: anything saved but not complete — her definition covers IN_PROGRESS", () => {
    expect(derive("IN_PROGRESS")).toBe("PAUSED");
    expect(derive("PAUSED")).toBe("PAUSED");
  });

  it("COMPLETE: completed with no outcome recorded", () => {
    expect(derive("COMPLETED")).toBe("COMPLETE");
  });

  it("LOCKED: any outcome recorded, regardless of status", () => {
    expect(derive("COMPLETED", "AWARDED")).toBe("LOCKED");
    expect(derive("COMPLETED", "DOES_NOT_QUALIFY")).toBe("LOCKED");
    expect(derive("COMPLETED", "QUALIFIES_NOT_AWARDED")).toBe("LOCKED");
    // Defensive: an outcome on a non-completed row still reads LOCKED.
    expect(derive("IN_PROGRESS", "AWARDED")).toBe("LOCKED");
  });

  it("LOCKED: a closed application, even without an outcome", () => {
    expect(derive("IN_PROGRESS", null, CLOSED)).toBe("LOCKED");
    expect(derive(null, null, CLOSED)).toBe("LOCKED");
  });

  it("exactly one state for every (status × outcome × closed) combination", () => {
    const statuses: (AssessmentStatus | null)[] = [
      null,
      "NOT_STARTED",
      "IN_PROGRESS",
      "PAUSED",
      "COMPLETED",
    ];
    const outcomes: (AssessmentOutcome | null)[] = [null, "AWARDED"];
    const closed: (Date | null)[] = [null, CLOSED];
    for (const s of statuses)
      for (const o of outcomes)
        for (const c of closed) {
          const state = derive(s, o, c);
          expect(["NOT_STARTED", "PAUSED", "COMPLETE", "LOCKED"]).toContain(
            state
          );
        }
  });
});
