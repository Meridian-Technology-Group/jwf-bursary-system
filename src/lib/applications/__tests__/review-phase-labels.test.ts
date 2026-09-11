import { describe, it, expect } from "vitest";
import { REVIEW_PHASE_LABEL, REVIEW_PHASE_FILTER_OPTIONS } from "@/lib/applications/review-phase-labels";
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

describe("REVIEW_PHASE_FILTER_OPTIONS — the status dropdown's entries", () => {
  it("offers each label exactly once", () => {
    const labels = REVIEW_PHASE_FILTER_OPTIONS.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('shows "Closed" once, carrying both phases that use the word', () => {
    // Charlotte, 10 Sep 2026: "why does closed show twice on the status
    // dropdown list?" DOES_NOT_QUALIFY and CLOSED deliberately converge.
    const closed = REVIEW_PHASE_FILTER_OPTIONS.filter((o) => o.label === "Closed");
    expect(closed).toHaveLength(1);
    expect(closed[0].phases.sort()).toEqual(["CLOSED", "DOES_NOT_QUALIFY"]);
  });

  it("covers every review phase, so no row becomes unfilterable", () => {
    const covered = REVIEW_PHASE_FILTER_OPTIONS.flatMap((o) => o.phases).sort();
    expect(covered).toEqual([...ALL_REVIEW_PHASES].sort());
  });
});
