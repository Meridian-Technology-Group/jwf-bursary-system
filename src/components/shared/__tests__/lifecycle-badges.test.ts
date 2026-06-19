import { describe, it, expect } from "vitest";
import { projectFormStatusForApplicant } from "../lifecycle-badges";

describe("projectFormStatusForApplicant — parent-safe label (Epic 01)", () => {
  it("never leaks internal assessment/outcome states — all post-submission collapses to one surface", () => {
    // SUBMITTED is the only post-submission form state; assessment/outcome are
    // separate columns the applicant never sees here.
    expect(projectFormStatusForApplicant("SUBMITTED", "NEW")).toBe("Submitted");
    expect(projectFormStatusForApplicant("SUBMITTED", "ROLLING_OVER")).toBe(
      "Received"
    );
  });

  it("maps pre-submission states to plain-English progress", () => {
    expect(projectFormStatusForApplicant("CREATED", "NEW")).toBe("Not Started");
    expect(projectFormStatusForApplicant("NOT_STARTED", "NEW")).toBe(
      "Not Started"
    );
    expect(projectFormStatusForApplicant("IN_PROGRESS", "NEW")).toBe(
      "In Progress"
    );
    expect(projectFormStatusForApplicant("FILLED_IN", "NEW")).toBe(
      "Ready to Submit"
    );
  });

  it("derives the Submitted/Received label from application type (signed diagram)", () => {
    expect(projectFormStatusForApplicant("SUBMITTED", "NEW")).toBe("Submitted");
    expect(projectFormStatusForApplicant("SUBMITTED", "ROLLING_OVER")).toBe(
      "Received"
    );
  });
});
