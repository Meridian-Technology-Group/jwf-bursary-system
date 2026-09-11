/**
 * D4 (6 Sep 2026), extended 8 Sep 2026 — the gap-code → group mapping from
 * Charlotte's definitive "Reason & Gap Codes" listing. Same
 * deprecate-and-replace convention as reason codes: the original 10 gap codes
 * (DB codes 1–10) are deprecated and her list is seeded as DB codes 101+, in
 * her four named groups.
 *
 * Her 8 Sep additions (Acrimonious Separation at display 10, Immaterial gap at
 * display 13) were appended as codes 112/113 rather than inserted in sequence,
 * so that no existing code had to be renumbered. That breaks the original
 * `display = code − 100` rule: her groups are no longer contiguous in code
 * space, so membership below is explicit rather than a numeric range. Display
 * ORDER comes from each row's `sortOrder` (what `getGapReasons` orders by);
 * the `range` strings here are her display numbers, used only as headings.
 *
 * Consumed by the recommendation form's gap picker (via `ReasonCodeSelector`'s
 * custom-heading props) so the picker renders her groups instead of the old
 * flat list. Deprecated codes bucket under "Other" — they only ever render for
 * historic recommendations.
 */

export const GAP_CODE_GROUPS = [
  { label: "External", range: "1 – 3", codes: [101, 102, 103] },
  { label: "Pastoral Leniency", range: "4 – 6", codes: [104, 105, 106] },
  { label: "Internal Bursary Bias", range: "7 – 10", codes: [107, 108, 109, 112] },
  { label: "Contextual", range: "11 – 13", codes: [110, 111, 113] },
] as const;

/** The selector's group heading for a gap code — "1 – 3: External" etc. */
export function gapGroupHeadingForCode(code: number): string {
  const group = GAP_CODE_GROUPS.find((g) => (g.codes as readonly number[]).includes(code));
  if (group) return `${group.range}: ${group.label}`;
  return "Other";
}

/** The ordered list of gap-picker group headings (for stable group ordering). */
export const GAP_CODE_GROUP_HEADINGS: string[] = [
  ...GAP_CODE_GROUPS.map((g) => `${g.range}: ${g.label}`),
  "Other",
];
