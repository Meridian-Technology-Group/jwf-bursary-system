import { describe, it, expect } from "vitest";
import { REVIEW_PHASE_LABEL } from "@/lib/applications/review-phase-labels";
import { ALL_REVIEW_PHASES } from "@/lib/applications/queue-filter";

describe("REVIEW_PHASE_LABEL (Item 1.1)", () => {
  it("covers every review phase exactly once (exhaustive)", () => {
    const labelKeys = Object.keys(REVIEW_PHASE_LABEL).sort();
    const allPhases = [...ALL_REVIEW_PHASES].sort();
    expect(labelKeys).toEqual(allPhases);
  });

  it("has a non-empty label for every phase", () => {
    for (const phase of ALL_REVIEW_PHASES) {
      expect(REVIEW_PHASE_LABEL[phase]).toBeTruthy();
    }
  });

  it("renders QUALIFIES / DOES_NOT_QUALIFY in state-map terms per D-3, not the legacy names", () => {
    expect(REVIEW_PHASE_LABEL.QUALIFIES).toBe("Active");
    expect(REVIEW_PHASE_LABEL.DOES_NOT_QUALIFY).toBe("Closed");
    expect(Object.values(REVIEW_PHASE_LABEL)).not.toContain("Qualifies");
    expect(Object.values(REVIEW_PHASE_LABEL)).not.toContain("Does not qualify");
  });
});
