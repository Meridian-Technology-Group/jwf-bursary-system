import { describe, it, expect } from "vitest";
import { groupReasonCodes } from "../reason-code-selector";
import type { ReasonCodeOption } from "../reason-code-selector";

/**
 * CALC-16 — `groupReasonCodes` is shared by every consumer of
 * `ReasonCodeSelector`. Default behaviour (`grouped: true`, the reason_codes
 * YoY taxonomy) buckets codes < 100 under "Legacy (deprecated)" — correct
 * there, since 1–35 really are deprecated placeholders. But `gap_reasons`
 * (codes 1–10) is a SEPARATE, all-active taxonomy; reusing the same grouping
 * mis-labelled every gap reason as legacy/deprecated. `grouped: false` skips
 * the category mapping entirely and renders one flat group instead.
 */

const gapReasons: ReasonCodeOption[] = Array.from({ length: 10 }, (_, i) => ({
  id: `gap-${i + 1}`,
  code: i + 1,
  label: `Gap reason ${i + 1}`,
}));

const yoyReasonCodes: ReasonCodeOption[] = [
  { id: "rc-101", code: 101, label: "First assessment" },
  { id: "rc-108", code: 108, label: "Income change" },
];

describe("groupReasonCodes (CALC-16)", () => {
  it("defaults to the YoY category grouping — codes < 100 bucket as Legacy (deprecated)", () => {
    const groups = groupReasonCodes(yoyReasonCodes);
    const labels = groups.map((g) => g.groupLabel);
    expect(labels).toEqual([
      "1 – 7: Circumstances",
      "8 – 21: Income & Employment",
    ]);
  });

  it("still buckets legacy placeholder codes (<100) under Legacy (deprecated) when grouped", () => {
    const groups = groupReasonCodes([
      { id: "rc-1", code: 1, label: "Legacy placeholder" },
    ]);
    expect(groups).toEqual([
      { groupLabel: "Legacy (deprecated)", codes: [{ id: "rc-1", code: 1, label: "Legacy placeholder" }] },
    ]);
  });

  it("renders gap_reasons (codes 1–10) as a single flat group when grouped=false", () => {
    const groups = groupReasonCodes(gapReasons, {
      grouped: false,
      flatGroupLabel: "Reasons for gap",
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].groupLabel).toBe("Reasons for gap");
    expect(groups[0].codes).toEqual(gapReasons);
    // Critically: none of these low-numbered codes get bucketed as legacy.
    expect(groups[0].groupLabel).not.toMatch(/legacy/i);
  });

  it("returns no groups for an empty flat list (no stray empty heading)", () => {
    expect(groupReasonCodes([], { grouped: false, flatGroupLabel: "Reasons for gap" })).toEqual(
      []
    );
  });

  it("defaults the flat heading to 'Reasons' when no label is supplied", () => {
    const groups = groupReasonCodes(gapReasons, { grouped: false });
    expect(groups[0].groupLabel).toBe("Reasons");
  });
});
