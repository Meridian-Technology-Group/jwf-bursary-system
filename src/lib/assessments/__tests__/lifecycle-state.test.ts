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

// ─── Epic 18 — final states in the strip ─────────────────────────────────────

import {
  lifecycleStripSlots,
  deriveAssessmentLifecycleState as derive18,
  ASSESSMENT_LIFECYCLE_LABELS as labels18,
} from "../lifecycle-state";

describe("Epic 18 — lifecycle strip final states", () => {
  it("derives the specific final state from assessments.status", () => {
    const base = { outcome: null, closedAt: null } as const;
    expect(derive18({ ...base, assessmentStatus: "NEW_AWARD" })).toBe("NEW_AWARD");
    expect(derive18({ ...base, assessmentStatus: "WAITING_LIST" })).toBe("WAITING_LIST");
    expect(derive18({ ...base, assessmentStatus: "CLOSED_ARCHIVED" })).toBe("ARCHIVED");
  });

  it("WP-B2 — COMPLETE is relabelled 'STORED AS COMPLETE' (same state)", () => {
    expect(labels18.COMPLETE).toBe("STORED AS COMPLETE");
    expect(
      derive18({ assessmentStatus: "COMPLETED", outcome: null, closedAt: null })
    ).toBe("COMPLETE");
  });

  it("the strip stays four chips, with the specific final in the fourth slot", () => {
    const slots = lifecycleStripSlots("NEW_AWARD");
    expect(slots).toHaveLength(4);
    expect(slots[3].key).toBe("NEW_AWARD");
    expect(slots[3].label).toBe("NEW AWARD");
    expect(slots[3].current).toBe(true);
    expect(slots.filter((s) => s.current)).toHaveLength(1);
  });

  it("pre-final states keep the generic LOCKED in the fourth slot", () => {
    const slots = lifecycleStripSlots("COMPLETE");
    expect(slots[3].key).toBe("LOCKED");
    expect(slots[2].current).toBe(true);
  });

  it("a legacy outcome lock still renders as LOCKED", () => {
    const slots = lifecycleStripSlots("LOCKED");
    expect(slots[3].key).toBe("LOCKED");
    expect(slots[3].current).toBe(true);
  });
});

describe("Epic 18b — rolled-over in the strip", () => {
  it("derives and labels the rolled-over lock", () => {
    expect(
      derive18({ assessmentStatus: "ROLLED_OVER", outcome: null, closedAt: null })
    ).toBe("ROLLED_OVER");
    const slots = lifecycleStripSlots("ROLLED_OVER");
    expect(slots[3].key).toBe("ROLLED_OVER");
    expect(slots[3].label).toBe("ROLLED OVER");
    expect(slots[3].current).toBe(true);
  });
});
