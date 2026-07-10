import { describe, it, expect } from "vitest";
import { validateReferenceInput } from "../reference";

describe("validateReferenceInput (item 11, Story 11.1/11.2)", () => {
  it("rejects an empty string", () => {
    expect(validateReferenceInput("")).toEqual({
      valid: false,
      error: "Bursary reference cannot be blank.",
    });
  });

  it("rejects a whitespace-only string", () => {
    expect(validateReferenceInput("   ")).toEqual({
      valid: false,
      error: "Bursary reference cannot be blank.",
    });
  });

  it("accepts a normal reference", () => {
    expect(validateReferenceInput("WS-20252026-0001")).toEqual({
      valid: true,
    });
  });

  it("accepts whitespace and special characters verbatim — no format restriction", () => {
    expect(validateReferenceInput("  ABC #1 / v2  ")).toEqual({ valid: true });
  });

  it("does not trim or otherwise transform the value — validation only", () => {
    // The helper's contract is validate-only; the caller persists the raw
    // input unchanged (verbatim preservation, Story 11.2, decided).
    const input = "  spaced-ref  ";
    const result = validateReferenceInput(input);
    expect(result.valid).toBe(true);
    expect(input).toBe("  spaced-ref  ");
  });
});
