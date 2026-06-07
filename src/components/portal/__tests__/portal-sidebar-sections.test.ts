import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIDEBAR_SECTIONS,
  buildSidebarSections,
} from "../portal-sidebar-sections";

/**
 * Locks the denominator rule unified in PR-2 (#6): the stepper, dashboard,
 * section header, and review counter all count "real, active, non-synthetic
 * sections only" → 10 for a new application, 9 for a re-assessment.
 *
 * `buildSidebarSections` is pure, so we exercise it directly with an empty
 * gap-status list (the structural section list is `DEFAULT_SIDEBAR_SECTIONS`;
 * enrichment is a no-op when there are no matching gap rows). This repo has no
 * jsdom/RTL — we unit-test the pure logic rather than render the stepper, the
 * same convention as the other component __tests__.
 */
describe("buildSidebarSections — section denominator (PR-2, #6)", () => {
  const countReal = (sections: { isSynthetic?: boolean }[]) =>
    sections.filter((s) => !s.isSynthetic).length;

  it("default list has 11 entries with exactly one synthetic (Review)", () => {
    expect(DEFAULT_SIDEBAR_SECTIONS).toHaveLength(11);

    const synthetic = DEFAULT_SIDEBAR_SECTIONS.filter((s) => s.isSynthetic);
    expect(synthetic).toHaveLength(1);
    expect(synthetic[0]?.slug).toBe("review");
  });

  it("a new application counts 10 real (non-synthetic) sections", () => {
    const sections = buildSidebarSections([]);

    // The synthetic Review entry stays navigable (present in the list)…
    expect(sections).toHaveLength(11);
    expect(sections.some((s) => s.isSynthetic && s.slug === "review")).toBe(true);

    // …but is excluded from the count → "N of 10".
    expect(countReal(sections)).toBe(10);
  });

  it("a re-assessment drops Family Identification → counts 9 real sections", () => {
    const sections = buildSidebarSections([], { isReassessment: true });

    // Family Identification is omitted entirely (not just uncounted).
    expect(sections.some((s) => s.slug === "family-id")).toBe(false);

    // Review still present and still synthetic.
    expect(sections.some((s) => s.isSynthetic && s.slug === "review")).toBe(true);

    // Re-assessment denominator → "N of 9".
    expect(countReal(sections)).toBe(9);
  });
});
