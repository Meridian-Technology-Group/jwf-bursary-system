import { describe, it, expect } from "vitest";
import {
  sanitizeCurrency,
  formatCurrencyDisplay,
} from "@/components/portal/form-fields/currency-input";

describe("sanitizeCurrency", () => {
  it("strips currency symbols, spaces and commas", () => {
    expect(sanitizeCurrency("£15,000")).toBe("15000");
    expect(sanitizeCurrency(" 1 000 ")).toBe("1000");
  });

  it("keeps only the first decimal point", () => {
    expect(sanitizeCurrency("1.2.3")).toBe("1.23");
  });

  it("strips leading zeros so typing after a default 0 doesn't accumulate", () => {
    // Reproduces the reported mobile bug: default "0" then digits 1,5,0,0,0.
    expect(sanitizeCurrency("015000")).toBe("15000");
    expect(sanitizeCurrency("01")).toBe("1");
  });

  it("preserves a lone zero and a leading zero before a decimal point", () => {
    expect(sanitizeCurrency("0")).toBe("0");
    expect(sanitizeCurrency("0.5")).toBe("0.5");
  });
});

describe("formatCurrencyDisplay", () => {
  it("adds thousands separators", () => {
    expect(formatCurrencyDisplay(15000)).toBe("15,000");
    expect(formatCurrencyDisplay("1234567")).toBe("1,234,567");
  });

  it("shows a clean value even if the stored string has leading zeros", () => {
    expect(formatCurrencyDisplay("015000")).toBe("15,000");
  });

  it("renders an empty string for blank / null / undefined", () => {
    expect(formatCurrencyDisplay("")).toBe("");
    expect(formatCurrencyDisplay(null)).toBe("");
    expect(formatCurrencyDisplay(undefined)).toBe("");
  });

  it("keeps a trailing decimal being typed", () => {
    expect(formatCurrencyDisplay("15000.")).toBe("15,000.");
    expect(formatCurrencyDisplay("0.5")).toBe("0.5");
  });
});
