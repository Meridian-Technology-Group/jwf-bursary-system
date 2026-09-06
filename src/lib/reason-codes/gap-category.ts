/**
 * D4 (6 Sep 2026) — the gap-code → group mapping from Charlotte's definitive
 * "Reason & Gap Codes" listing. Same deprecate-and-replace convention as
 * reason codes: the original 10 gap codes (DB codes 1–10) are deprecated and
 * her 11-code list is seeded as DB codes 101–111, display number = code − 100,
 * in her four named groups.
 *
 * Consumed by the recommendation form's gap picker (via `ReasonCodeSelector`'s
 * custom-heading props) so the picker renders her groups instead of the old
 * flat list. Deprecated codes bucket under "Other" — they only ever render for
 * historic recommendations.
 */

export const GAP_CODE_GROUPS = [
  { label: "External", range: "1 – 3", from: 1, to: 3 },
  { label: "Pastoral Leniency", range: "4 – 6", from: 4, to: 6 },
  { label: "Internal Bursary Bias", range: "7 – 9", from: 7, to: 9 },
  { label: "Contextual", range: "10 – 11", from: 10, to: 11 },
] as const;

/** The selector's group heading for a gap code — "1 – 3: External" etc. */
export function gapGroupHeadingForCode(code: number): string {
  if (code >= 100) {
    const display = code - 100;
    const group = GAP_CODE_GROUPS.find((g) => display >= g.from && display <= g.to);
    if (group) return `${group.range}: ${group.label}`;
  }
  return "Other";
}

/** The ordered list of gap-picker group headings (for stable group ordering). */
export const GAP_CODE_GROUP_HEADINGS: string[] = [
  ...GAP_CODE_GROUPS.map((g) => `${g.range}: ${g.label}`),
  "Other",
];
