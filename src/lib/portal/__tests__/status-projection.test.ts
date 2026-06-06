import { describe, it, expect } from "vitest";
import {
  projectParentStatus,
  submittedLabel,
} from "@/lib/portal/status-projection";

describe("submittedLabel (D2)", () => {
  it("reads Received for new, Submitted for rolling-over", () => {
    expect(submittedLabel("NEW")).toBe("Received");
    expect(submittedLabel("ROLLING_OVER")).toBe("Submitted");
  });
});

describe("projectParentStatus — parent-safe trim (Epic 05 §3.6)", () => {
  it("maps a draft to plain-English progress (no internal enum)", () => {
    const p = projectParentStatus({
      formStatus: "IN_PROGRESS",
      applicationType: "NEW",
    });
    expect(p.step).toBe("draft");
    expect(p.label).toBe("In Progress");
    expect(p.showOutcome).toBe(false);
  });

  it("labels a filled-in draft Ready to Submit", () => {
    const p = projectParentStatus({
      formStatus: "FILLED_IN",
      applicationType: "NEW",
    });
    expect(p.label).toBe("Ready to Submit");
    expect(p.step).toBe("draft");
  });

  it("collapses a submitted+IN_PROGRESS assessment to 'Being assessed' (never IN_PROGRESS)", () => {
    const p = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "NEW",
      assessmentStatus: "IN_PROGRESS",
      outcome: null,
    });
    expect(p.step).toBe("assessing");
    expect(p.label).toBe("Being assessed");
    expect(p.label).not.toContain("IN_PROGRESS");
  });

  it("NEVER surfaces PAUSED to a parent — paused still reads 'Being assessed'", () => {
    const p = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "ROLLING_OVER",
      assessmentStatus: "PAUSED",
      outcome: null,
    });
    expect(p.step).toBe("assessing");
    expect(p.label).toBe("Being assessed");
    // no internal label anywhere in the projection
    const serialised = JSON.stringify(p);
    expect(serialised).not.toContain("PAUSED");
    expect(serialised).not.toContain("IN_PROGRESS");
  });

  it("shows an awarded outcome without the enum name", () => {
    const p = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "NEW",
      assessmentStatus: "COMPLETED",
      outcome: "AWARDED",
    });
    expect(p.step).toBe("outcome");
    expect(p.showOutcome).toBe(true);
    expect(p.outcome?.awarded).toBe(true);
    const serialised = JSON.stringify(p);
    expect(serialised).not.toContain("AWARDED");
    expect(serialised).not.toContain("QUALIFIES");
    expect(serialised).not.toContain("DOES_NOT_QUALIFY");
  });

  it("shows a non-awarded outcome generically (no enum names leaked)", () => {
    for (const outcome of ["QUALIFIES_NOT_AWARDED", "DOES_NOT_QUALIFY"] as const) {
      const p = projectParentStatus({
        formStatus: "SUBMITTED",
        applicationType: "NEW",
        assessmentStatus: "COMPLETED",
        outcome,
      });
      expect(p.step).toBe("outcome");
      expect(p.outcome?.awarded).toBe(false);
      const serialised = JSON.stringify(p);
      expect(serialised).not.toContain("QUALIFIES");
      expect(serialised).not.toContain("DOES_NOT_QUALIFY");
    }
  });

  it("builds a four-step timeline with the right reached/current flags", () => {
    const draft = projectParentStatus({
      formStatus: "NOT_STARTED",
      applicationType: "NEW",
    });
    expect(draft.timeline.map((s) => s.id)).toEqual([
      "draft",
      "submitted",
      "assessing",
      "outcome",
    ]);
    expect(draft.timeline.find((s) => s.id === "draft")?.current).toBe(true);
    expect(draft.timeline.find((s) => s.id === "submitted")?.reached).toBe(false);

    const assessing = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "NEW",
      assessmentStatus: "NOT_STARTED",
      outcome: null,
    });
    expect(assessing.timeline.find((s) => s.id === "submitted")?.reached).toBe(
      true
    );
    expect(assessing.timeline.find((s) => s.id === "assessing")?.current).toBe(
      true
    );
    expect(assessing.timeline.find((s) => s.id === "outcome")?.reached).toBe(
      false
    );
  });
});
