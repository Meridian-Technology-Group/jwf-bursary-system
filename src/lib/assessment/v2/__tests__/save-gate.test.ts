import { describe, it, expect } from "vitest";
import { reduceSaveError, canProceedAfterSave, type SaveOutcome } from "../save-gate";

/**
 * CALC-15 — pure save-outcome gating. Covers the two behaviours the v2
 * assessor form's Save/Complete/Pause handlers are built on:
 *  - the persistent "last save failed" banner text only clears on success;
 *  - Complete/Pause may only proceed after a successful save.
 */

describe("reduceSaveError", () => {
  it("returns null (no banner) for a successful save", () => {
    const outcome: SaveOutcome = { success: true };
    expect(reduceSaveError(outcome)).toBeNull();
  });

  it("returns the error text for a failed save", () => {
    const outcome: SaveOutcome = { success: false, error: "Failed to save assessment." };
    expect(reduceSaveError(outcome)).toBe("Failed to save assessment.");
  });

  it("a failed outcome always wins — the caller must not have pre-cleared the banner", () => {
    // Simulates: banner already showing an error, a NEW save fails again —
    // the reducer must still return the (possibly new) error text, not null.
    const first = reduceSaveError({ success: false, error: "PrismaClientValidationError" });
    const second = reduceSaveError({ success: false, error: "PrismaClientValidationError" });
    expect(first).toBe("PrismaClientValidationError");
    expect(second).toBe("PrismaClientValidationError");
  });

  it("a subsequent SUCCESSFUL save clears a previously-failed banner", () => {
    expect(reduceSaveError({ success: false, error: "boom" })).toBe("boom");
    expect(reduceSaveError({ success: true })).toBeNull();
  });
});

describe("canProceedAfterSave", () => {
  it("allows Complete/Pause to proceed after a successful save", () => {
    expect(canProceedAfterSave({ success: true })).toBe(true);
  });

  it("blocks Complete/Pause when the preceding save failed", () => {
    expect(
      canProceedAfterSave({
        success: false,
        error: "[saveAssessmentAction] PrismaClientValidationError",
      })
    ).toBe(false);
  });
});
