import { describe, it, expect } from "vitest";
import {
  projectParentStatus,
  submittedLabel,
} from "@/lib/portal/status-projection";

describe("submittedLabel (signed bursary-flow diagram)", () => {
  it("reads Submitted for new, Received for rolling-over", () => {
    expect(submittedLabel("NEW")).toBe("Submitted");
    expect(submittedLabel("ROLLING_OVER")).toBe("Received");
  });
});

describe("projectParentStatus — applicant-only Application-track states", () => {
  it("maps a draft to plain-English progress (no internal enum)", () => {
    const p = projectParentStatus({
      formStatus: "IN_PROGRESS",
      applicationType: "NEW",
    });
    expect(p.step).toBe("draft");
    expect(p.label).toBe("In Progress");
  });

  it("labels a not-started draft Not Started", () => {
    const p = projectParentStatus({
      formStatus: "NOT_STARTED",
      applicationType: "NEW",
    });
    expect(p.label).toBe("Not Started");
    expect(p.step).toBe("draft");
  });

  it("labels a filled-in draft Ready to Submit", () => {
    const p = projectParentStatus({
      formStatus: "FILLED_IN",
      applicationType: "NEW",
    });
    expect(p.label).toBe("Ready to Submit");
    expect(p.step).toBe("draft");
  });

  it("labels a submitted NEW application Submitted", () => {
    const p = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "NEW",
    });
    expect(p.step).toBe("submitted");
    expect(p.label).toBe("Submitted");
  });

  it("labels a submitted ROLLING_OVER application Received", () => {
    const p = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "ROLLING_OVER",
    });
    expect(p.step).toBe("submitted");
    expect(p.label).toBe("Received");
  });

  it("NEVER surfaces the Foundation's assessment state — a paused assessment still reads Submitted", () => {
    const p = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "NEW",
      assessmentStatus: "PAUSED",
      outcome: null,
    });
    expect(p.step).toBe("submitted");
    expect(p.label).toBe("Submitted");
    const serialised = JSON.stringify(p);
    expect(serialised).not.toContain("PAUSED");
    expect(serialised).not.toContain("IN_PROGRESS");
    expect(serialised).not.toContain("assessed");
  });

  it("NEVER surfaces the outcome — an awarded application still reads Submitted (no enum, no 'Outcome')", () => {
    const p = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "NEW",
      assessmentStatus: "COMPLETED",
      outcome: "AWARDED",
    });
    expect(p.step).toBe("submitted");
    expect(p.label).toBe("Submitted");
    const serialised = JSON.stringify(p);
    expect(serialised).not.toContain("AWARDED");
    expect(serialised).not.toContain("Outcome");
    expect(serialised).not.toContain("assessed");
  });

  it("builds a two-step timeline with the right reached/current flags", () => {
    const draft = projectParentStatus({
      formStatus: "NOT_STARTED",
      applicationType: "NEW",
    });
    expect(draft.timeline.map((s) => s.id)).toEqual(["draft", "submitted"]);
    expect(draft.timeline.find((s) => s.id === "draft")?.current).toBe(true);
    expect(draft.timeline.find((s) => s.id === "submitted")?.reached).toBe(
      false
    );

    const submitted = projectParentStatus({
      formStatus: "SUBMITTED",
      applicationType: "NEW",
    });
    expect(submitted.timeline.find((s) => s.id === "submitted")?.reached).toBe(
      true
    );
    expect(submitted.timeline.find((s) => s.id === "submitted")?.current).toBe(
      true
    );
  });
});
