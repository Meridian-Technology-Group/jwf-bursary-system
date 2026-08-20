import { describe, expect, it } from "vitest";
import { resolveAwardSurfaceState } from "../award-surface-state";

describe("resolveAwardSurfaceState (Epic 15 M6 / CI-11, LA15-4)", () => {
  it("no assessment row → NO_ASSESSMENT in both modes", () => {
    for (const mode of ["gated", "workspace"] as const) {
      expect(
        resolveAwardSurfaceState({
          mode,
          assessmentStatus: null,
          engineVersion: "v2",
          hasSnapshot: false,
        })
      ).toBe("NO_ASSESSMENT");
    }
  });

  it("gated mode keeps the completed-first gate for any open status", () => {
    for (const status of ["NOT_STARTED", "IN_PROGRESS", "PAUSED"] as const) {
      expect(
        resolveAwardSurfaceState({
          mode: "gated",
          assessmentStatus: status,
          engineVersion: "v2",
          hasSnapshot: true,
        })
      ).toBe("GATE");
    }
  });

  it("workspace mode renders the form OUTCOME-LOCKED for an in-progress v2 with a saved snapshot", () => {
    for (const status of ["IN_PROGRESS", "PAUSED", "NOT_STARTED"] as const) {
      expect(
        resolveAwardSurfaceState({
          mode: "workspace",
          assessmentStatus: status,
          engineVersion: "v2",
          hasSnapshot: true,
        })
      ).toBe("FORM_OUTCOME_LOCKED");
    }
  });

  it("workspace mode without a saved calculation prompts for a save — never the completion gate", () => {
    expect(
      resolveAwardSurfaceState({
        mode: "workspace",
        assessmentStatus: "IN_PROGRESS",
        engineVersion: "v2",
        hasSnapshot: false,
      })
    ).toBe("NO_SAVED_CALCULATION");
  });

  it("v1 keeps the gate even in workspace mode", () => {
    expect(
      resolveAwardSurfaceState({
        mode: "workspace",
        assessmentStatus: "IN_PROGRESS",
        engineVersion: "v1",
        hasSnapshot: true,
      })
    ).toBe("GATE");
  });

  it("COMPLETED renders the full form in both modes", () => {
    for (const mode of ["gated", "workspace"] as const) {
      expect(
        resolveAwardSurfaceState({
          mode,
          assessmentStatus: "COMPLETED",
          engineVersion: "v2",
          hasSnapshot: true,
        })
      ).toBe("FORM");
    }
  });

  it("COMPLETED v2 with a missing snapshot is refused as corrupt (CALC-15), in both modes", () => {
    for (const mode of ["gated", "workspace"] as const) {
      expect(
        resolveAwardSurfaceState({
          mode,
          assessmentStatus: "COMPLETED",
          engineVersion: "v2",
          hasSnapshot: false,
        })
      ).toBe("SNAPSHOT_INCOMPLETE");
    }
  });

  it("COMPLETED v1 renders the form (no snapshot requirement)", () => {
    expect(
      resolveAwardSurfaceState({
        mode: "gated",
        assessmentStatus: "COMPLETED",
        engineVersion: "v1",
        hasSnapshot: false,
      })
    ).toBe("FORM");
  });
});
