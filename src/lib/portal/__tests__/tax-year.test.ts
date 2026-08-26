import { describe, it, expect } from "vitest";
import {
  academicYearStartYear,
  getTaxYearLabels,
  resolveTaxYearBasisYear,
} from "@/lib/portal/tax-year";

describe("academicYearStartYear", () => {
  it.each([
    ["2026/27", 2026],
    ["2025/2026", 2025],
    ["2024-25", 2024],
    ["2024", 2024],
    ["  2027/28 ", 2027],
  ])("parses %s → %i", (input, expected) => {
    expect(academicYearStartYear(input)).toBe(expected);
  });

  it("falls back to the current year on a malformed value", () => {
    const now = new Date().getUTCFullYear();
    expect(academicYearStartYear("not-a-year")).toBe(now);
    expect(academicYearStartYear(null)).toBe(now);
    expect(academicYearStartYear(undefined)).toBe(now);
    expect(academicYearStartYear("")).toBe(now);
  });
});

describe("getTaxYearLabels", () => {
  it("derives every label from the round start year (D5)", () => {
    const labels = getTaxYearLabels("2026/27");
    expect(labels.startYear).toBe(2026);
    expect(labels.financialYearEndedLabel).toBe(
      "financial year ended 4 April 2026"
    );
    expect(labels.financialYearEndDateLabel).toBe("4 April 2026");
    expect(labels.p60DateLabel).toBe("April 2026");
    expect(labels.marchPayslipLabel).toBe("March 2026 payslip");
    expect(labels.sa302TaxYearLabel).toBe("2025/26");
    // CH-47 — the arrears year the self-employed footnote now names, one behind.
    expect(labels.sa302ArrearsTaxYearLabel).toBe("2024/25");
    expect(labels.leftEmploymentSinceLabel).toBe("since April 2026");
  });

  it("two-digit suffix handles a turn of the century", () => {
    expect(getTaxYearLabels("2100/01").sa302TaxYearLabel).toBe("2099/00");
    expect(getTaxYearLabels("2100/01").sa302ArrearsTaxYearLabel).toBe("2098/99");
  });

  it("never hard-codes a year — different rounds give different labels", () => {
    const a = getTaxYearLabels("2026/27");
    const b = getTaxYearLabels("2027/28");
    expect(a.marchPayslipLabel).not.toBe(b.marchPayslipLabel);
  });
});

// ─── CH-47 — the self-employed arrears year ────────────────────────────────

describe("CH-47 — sa302ArrearsTaxYearLabel", () => {
  it("is always exactly one tax year behind the primary SA302 label", () => {
    // The relationship is what matters, not the literals: a self-employed
    // parent reporting in arrears files the year before the one everyone else
    // reports. Asserting the gap catches a drift in either label.
    for (const year of ["2024/25", "2025/26", "2026/27", "2030/31"]) {
      const labels = getTaxYearLabels(year);
      const primaryStart = Number.parseInt(labels.sa302TaxYearLabel.slice(0, 4), 10);
      const arrearsStart = Number.parseInt(
        labels.sa302ArrearsTaxYearLabel.slice(0, 4),
        10
      );
      expect(primaryStart - arrearsStart).toBe(1);
    }
  });

  it("pads the two-digit suffix across a century boundary", () => {
    expect(getTaxYearLabels("2101/02").sa302ArrearsTaxYearLabel).toBe("2099/00");
  });

  it("derives from the round, like every other label (D5)", () => {
    expect(getTaxYearLabels("2026/27").sa302ArrearsTaxYearLabel).toBe("2024/25");
    expect(getTaxYearLabels("2027/28").sa302ArrearsTaxYearLabel).toBe("2025/26");
  });
});

// ─── CH-47b — the winter-window switch (Epic 19 WP-D5) ─────────────────────

/**
 * Charlotte decided this on 24 Aug 2026: switch the winter window over.
 *
 * The defect it fixes: keying the tax year to the round's academic year alone
 * means a NEXT-year application filled in during the winter window (before the
 * 12 Apr cutover, LA-4) is asked for the (Y-1)/Y tax year **while that year is
 * still running**. A parent cannot evidence a tax year that has not ended.
 *
 * The deferral note (Epic 17) asked for this to be done "deliberately, well
 * before November". Two properties matter most and both are pinned below:
 *
 *  1. **It is inert everywhere except NA_NEXT_WINTER.** Production holds one
 *     round (2026/27) which resolves to NA_CURRENT, so no live application's
 *     wording moves.
 *  2. **Omitting the basis year reproduces the old behaviour byte-for-byte**,
 *     so the contribute path and every pre-existing caller are untouched until
 *     explicitly opted in.
 */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("resolveTaxYearBasisYear — CH-47b", () => {
  it("does not move a CURRENT-year round (NA_CURRENT)", () => {
    // The live production case on the day this shipped: a 2026/27 round worked
    // on 26 Aug 2026. Inertness here is the whole blast-radius argument.
    expect(
      resolveTaxYearBasisYear({
        academicYear: "2026/27",
        applicationType: "NEW",
        onDate: d("2026-08-26"),
      })
    ).toBe(2026);
  });

  it("steps a NEXT-year round back one year inside the winter window", () => {
    // 2027/28 round, worked in Jan 2027 — before the 12 Apr 2027 cutover, so
    // the 2026/27 tax year has not ended.
    expect(
      resolveTaxYearBasisYear({
        academicYear: "2027/28",
        applicationType: "NEW",
        onDate: d("2027-01-15"),
      })
    ).toBe(2026);
  });

  it("steps back from the day the winter window opens (10 Nov)", () => {
    expect(
      resolveTaxYearBasisYear({
        academicYear: "2027/28",
        applicationType: "NEW",
        onDate: d("2026-11-10"),
      })
    ).toBe(2026);
  });

  it("does NOT step back in the spring window (NA_NEXT_SPRING)", () => {
    // On/after 12 Apr the tax year has ended, so the round-derived label is
    // already right.
    expect(
      resolveTaxYearBasisYear({
        academicYear: "2027/28",
        applicationType: "NEW",
        onDate: d("2027-04-12"),
      })
    ).toBe(2027);
  });

  it("switches exactly on the 12 April cutover, not a day either side", () => {
    const winter = resolveTaxYearBasisYear({
      academicYear: "2027/28",
      applicationType: "NEW",
      onDate: d("2027-04-11"),
    });
    const spring = resolveTaxYearBasisYear({
      academicYear: "2027/28",
      applicationType: "NEW",
      onDate: d("2027-04-12"),
    });
    expect(winter).toBe(2026);
    expect(spring).toBe(2027);
  });

  it("does not move a reassessment (RA)", () => {
    // RA runs 12 Apr → 22 May, after the tax year ends, so it declares the
    // just-ended year — which the round-derived labels already describe.
    expect(
      resolveTaxYearBasisYear({
        academicYear: "2027/28",
        applicationType: "ROLLING_OVER",
        onDate: d("2027-01-15"),
      })
    ).toBe(2027);
  });

  it("falls back sanely on a malformed academic year", () => {
    expect(() =>
      resolveTaxYearBasisYear({
        academicYear: "not-a-year",
        applicationType: "NEW",
        onDate: d("2027-01-15"),
      })
    ).not.toThrow();
  });
});

describe("getTaxYearLabels with a basis year — CH-47b", () => {
  it("reproduces the pre-CH-47b labels when no basis year is given", () => {
    // Back-compat is load-bearing: the contribute path and several callers pass
    // no options, and their wording must not move.
    const withOut = getTaxYearLabels("2027/28");
    const withNull = getTaxYearLabels("2027/28", { basisYear: null });
    const withUndef = getTaxYearLabels("2027/28", { basisYear: undefined });
    expect(withNull).toEqual(withOut);
    expect(withUndef).toEqual(withOut);
    expect(withOut.sa302TaxYearLabel).toBe("2026/27");
    expect(withOut.basisYear).toBe(2027);
  });

  it("steps the WHOLE label set back together, not just the tax year", () => {
    // Every one of these describes the same tax year, so they must move as one
    // — a half-shifted set would ask for a P60 and a payslip from different
    // years, which is worse than the original defect.
    const labels = getTaxYearLabels("2027/28", { basisYear: 2026 });
    expect(labels.startYear).toBe(2027); // the ROUND's year is unchanged
    expect(labels.basisYear).toBe(2026);
    expect(labels.financialYearEndedLabel).toBe(
      "financial year ended 4 April 2026"
    );
    expect(labels.financialYearEndDateLabel).toBe("4 April 2026");
    expect(labels.p60DateLabel).toBe("April 2026");
    expect(labels.marchPayslipLabel).toBe("March 2026 payslip");
    expect(labels.sa302TaxYearLabel).toBe("2025/26");
    expect(labels.sa302ArrearsTaxYearLabel).toBe("2024/25");
    expect(labels.leftEmploymentSinceLabel).toBe("since April 2026");
  });

  it("keeps the CH-47 arrears gap at exactly one year after the shift", () => {
    const labels = getTaxYearLabels("2027/28", { basisYear: 2026 });
    const primary = Number.parseInt(labels.sa302TaxYearLabel.slice(0, 4), 10);
    const arrears = Number.parseInt(
      labels.sa302ArrearsTaxYearLabel.slice(0, 4),
      10
    );
    expect(primary - arrears).toBe(1);
  });

  it("stops asking about a future April — a latent bug the shift also fixes", () => {
    // "Have you left employment since April 2027?" asked of someone filling the
    // form in January 2027 is unanswerable: that April has not happened.
    const basisYear = resolveTaxYearBasisYear({
      academicYear: "2027/28",
      applicationType: "NEW",
      onDate: d("2027-01-15"),
    });
    const labels = getTaxYearLabels("2027/28", { basisYear });
    expect(labels.leftEmploymentSinceLabel).toBe("since April 2026");
    expect(labels.leftEmploymentSinceLabel).not.toBe("since April 2027");
  });

  it("ignores a non-finite basis year rather than rendering NaN", () => {
    const labels = getTaxYearLabels("2026/27", {
      basisYear: Number.NaN,
    });
    expect(labels.basisYear).toBe(2026);
    expect(labels.p60DateLabel).toBe("April 2026");
    expect(JSON.stringify(labels)).not.toContain("NaN");
  });

  it("end to end: a winter application gets her tax year, not the engine's", () => {
    // The scenario table's own answer for NA_NEXT_WINTER on a 2027/28 round is
    // "2025/26" (RoundWindow.defaultTaxYear). The labels now agree with it.
    const basisYear = resolveTaxYearBasisYear({
      academicYear: "2027/28",
      applicationType: "NEW",
      onDate: d("2027-01-15"),
    });
    expect(getTaxYearLabels("2027/28", { basisYear }).sa302TaxYearLabel).toBe(
      "2025/26"
    );
  });
});
