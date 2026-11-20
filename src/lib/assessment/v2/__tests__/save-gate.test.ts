import { describe, it, expect } from "vitest";
import {
  reduceSaveError,
  canProceedAfterSave,
  v2SnapshotForSave,
  type SaveOutcome,
} from "../save-gate";
import type { AssessmentV2Output } from "../orchestrator";

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

describe("v2SnapshotForSave", () => {
  const KEYS = [
    "totalHouseholdNetIncome",
    "notionalEssentials",
    "notionalCar",
    "notionalPublicTransport",
    "notionalJwfAllowance",
    "notionalSavingsBenchmark",
    "savingsTestNumber",
    "totalNotionalSpend",
    "ndiAfterNotionalSpend",
    "derivedYearlyDebtRepayments",
    "yearlyDebtExposure",
    "debtOverNdiRatio",
    "debtStatusLabel",
    "incomeCategory",
    "propertyCategoryDerived",
    "propertyEquityCategory",
    "financialEquityLabel",
    "lifestyleSqueezeRatio",
    "lifestyleSqueezeLabel",
    "actualRemainingDi",
    "theoreticalBenchmarkDi",
    "affordabilityAdjustedDi",
    "recommendedPayableFees",
  ].sort();

  it("a calculation that could not run CLEARS every snapshot column (explicit nulls, never omitted)", () => {
    const snap = v2SnapshotForSave(null);
    // Omitting the keys let the partial update keep the old figures, and the
    // completion guard (totalHouseholdNetIncome) pass on them.
    expect(Object.keys(snap).sort()).toEqual(KEYS);
    for (const key of KEYS) {
      expect(snap[key as keyof typeof snap]).toBeNull();
    }
  });

  it("a computed result maps 1:1, keeping zeros and the engine's own nulls", () => {
    const output = {
      householdNetIncome: 52000,
      notionalEssentials: 18000,
      notionalCar: 0,
      notionalPublicTransport: 1200,
      notionalJwfAllowance: 2500,
      notionalSavingsBenchmark: 3000,
      savingsTestNumber: 0,
      totalNotionalSpend: 24700,
      ndiAfterNotionalSpend: 27300,
      derivedYearlyDebtRepayments: 1800,
      yearlyDebtExposure: 1800,
      debtOverNdiRatio: 0.0659,
      debtStatusLabel: "MANAGEABLE",
      incomeCategory: null,
      propertyCategoryDerived: 2,
      propertyEquityCategory: null,
      financialEquityLabel: null,
      lifestyleSqueezeRatio: 0.12,
      lifestyleSqueezeLabel: "LOW",
      actualRemainingDi: 9100,
      theoreticalBenchmarkDi: 11000,
      affordabilityAdjustedDi: 10000,
      recommendedPayableFees: 9100,
    } as unknown as AssessmentV2Output;

    const snap = v2SnapshotForSave(output);

    expect(Object.keys(snap).sort()).toEqual(KEYS);
    expect(snap.totalHouseholdNetIncome).toBe(52000);
    expect(snap.notionalCar).toBe(0);
    expect(snap.savingsTestNumber).toBe(0);
    expect(snap.incomeCategory).toBeNull();
    expect(snap.debtStatusLabel).toBe("MANAGEABLE");
    expect(snap.recommendedPayableFees).toBe(9100);
  });
});
