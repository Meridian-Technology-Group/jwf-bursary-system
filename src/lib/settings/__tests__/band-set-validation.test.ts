import { describe, it, expect } from "vitest";
import { validateBandSet } from "../band-set-validation";

describe("validateBandSet", () => {
  it("accepts the real affordability grid (contiguous, no open ends)", () => {
    const bands = [
      { floor: 27001, ceiling: 29000 },
      { floor: 29001, ceiling: 32000 },
      { floor: 32001, ceiling: 35000 },
    ];
    // Note: this grid's rows are contiguous in the "+1" sense (29001 follows
    // 29000), which the epsilon (default 0.02) does NOT cover — so this grid
    // is intentionally checked with a wider epsilon reflecting its £1 steps.
    const result = validateBandSet(bands, { epsilon: 1 });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts the real debt-ratio bands (contiguous, open-ended top)", () => {
    const bands = [
      { floor: null, ceiling: 0 },
      { floor: 0, ceiling: 0.1 },
      { floor: 0.1, ceiling: 0.3 },
      { floor: 0.3, ceiling: 0.5 },
      { floor: 0.5, ceiling: null },
    ];
    const result = validateBandSet(bands);
    expect(result.valid).toBe(true);
  });

  it("accepts the financial-equity epsilon gap (-0.01 ceiling before a 0 floor)", () => {
    const bands = [
      { floor: null, ceiling: -0.01 },
      { floor: 0, ceiling: 0 },
      { floor: 0, ceiling: 50000 },
    ];
    const result = validateBandSet(bands);
    expect(result.valid).toBe(true);
  });

  it("flags an inverted row (ceiling below floor)", () => {
    const result = validateBandSet([{ floor: 100, ceiling: 50 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/ceiling \(50\) is below floor \(100\)/);
  });

  it("flags a gap between bands", () => {
    const bands = [
      { floor: 0, ceiling: 100 },
      { floor: 200, ceiling: 300 },
    ];
    const result = validateBandSet(bands);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Gap"))).toBe(true);
  });

  it("flags an overlap between bands", () => {
    const bands = [
      { floor: 0, ceiling: 100 },
      { floor: 50, ceiling: 200 },
    ];
    const result = validateBandSet(bands);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Overlap"))).toBe(true);
  });

  it("flags a duplicate ceiling", () => {
    const bands = [
      { floor: 0, ceiling: 100 },
      { floor: 0, ceiling: 100 },
    ];
    const result = validateBandSet(bands);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicate ceiling"))).toBe(true);
  });

  it("flags duplicate open-ended (null) ceilings", () => {
    const bands = [
      { floor: 0, ceiling: null },
      { floor: 100, ceiling: null },
    ];
    const result = validateBandSet(bands);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("open-ended"))).toBe(true);
  });

  it("rejects an empty band set", () => {
    const result = validateBandSet([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["At least one band row is required."]);
  });

  it("collects multiple independent errors at once", () => {
    const bands = [
      { floor: 100, ceiling: 50 }, // inverted
      { floor: 200, ceiling: 300 },
      { floor: 500, ceiling: 300 }, // duplicate ceiling + inverted-order gap
    ];
    const result = validateBandSet(bands);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
