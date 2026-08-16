// Epic 14 C1 (CG-17) — Assessments-queue status derivation.

import { describe, expect, it } from "vitest";

import { deriveAssessmentQueueStatus } from "../queue-status";

describe("deriveAssessmentQueueStatus", () => {
  const base = {
    assessmentStatus: null,
    outcome: null,
    closedAt: null,
  } as const;

  it("a submitted application with no assessment row is due / not started", () => {
    expect(deriveAssessmentQueueStatus({ ...base })).toBe("NOT_STARTED");
  });

  it("NOT_STARTED assessment row is still due", () => {
    expect(
      deriveAssessmentQueueStatus({ ...base, assessmentStatus: "NOT_STARTED" })
    ).toBe("NOT_STARTED");
  });

  it.each(["IN_PROGRESS", "PAUSED", "COMPLETED"] as const)(
    "passes %s through",
    (status) => {
      expect(
        deriveAssessmentQueueStatus({ ...base, assessmentStatus: status })
      ).toBe(status);
    }
  );

  it("an outcome locks the assessment regardless of status (Epic 13 C1)", () => {
    expect(
      deriveAssessmentQueueStatus({
        ...base,
        assessmentStatus: "COMPLETED",
        outcome: "AWARDED",
      })
    ).toBe("LOCKED");
  });

  it("a closed application locks it too, even without an assessment", () => {
    expect(
      deriveAssessmentQueueStatus({ ...base, closedAt: new Date() })
    ).toBe("LOCKED");
  });
});
