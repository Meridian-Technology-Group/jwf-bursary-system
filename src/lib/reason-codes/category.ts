/**
 * Epic 08 / CALC-09 — single source of truth for the reason-code → category
 * grouping. Both the recommendation selector (`reason-code-selector.tsx`,
 * `groupReasonCodes`) and the settings table (`settings/reason-code-table.tsx`,
 * `getCategory`) consume this util so the two UIs can never drift.
 *
 * Three generations, never deleted (CALC-09's deprecate-and-replace rule):
 *
 *   1–35     the original placeholders — deprecated, bucket "Legacy".
 *   101–137  the 24 Aug workbook transcription (display = code − 100) —
 *            deprecated 6 Sep 2026 when her reviewed list landed (D4 closed).
 *   201–241  Charlotte's DEFINITIVE list ("Reason & Gap Codes", 6 Sep 2026),
 *            display = code − 200, using her regrouping:
 *
 *   1–7    Circumstances
 *   8–26   Income & Employment
 *   27–33  Property & Assets
 *   34–37  Documentation & Compliance
 *   38–41  Fees & Adjustments        (incl. display 41 "Other")
 *
 * Deprecated codes never appear in the selection picker (it is fed only
 * active codes); their buckets exist for settings/management views and for
 * historic recommendations, which keep rendering under the category they
 * were picked from.
 */

/**
 * Stable category keys (ordered) used to bucket reason codes. The `range`
 * strings are the CURRENT (D4, 6 Sep 2026) taxonomy — DB codes 201–241,
 * display number = code − 200 — which is the only generation active pickers
 * ever see. The retired 101–137 generation keeps its own range mapping in
 * `categoryKeyForCode` so a historic recommendation still buckets correctly,
 * but its rows are deprecated and never reach the range-labelled headings.
 */
export const REASON_CODE_CATEGORIES = [
  { key: "circumstances", label: "Circumstances", range: "1 – 7" },
  { key: "income", label: "Income & Employment", range: "8 – 26" },
  { key: "property", label: "Property & Assets", range: "27 – 33" },
  { key: "documentation", label: "Documentation & Compliance", range: "34 – 37" },
  { key: "fees", label: "Fees & Adjustments", range: "38 – 41" },
  { key: "other", label: "Other", range: "" },
  { key: "legacy", label: "Legacy (deprecated)", range: "" },
] as const;

export type ReasonCodeCategoryKey =
  (typeof REASON_CODE_CATEGORIES)[number]["key"];

/** The category key for a reason code's numeric (DB) value. */
export function categoryKeyForCode(code: number): ReasonCodeCategoryKey {
  if (code < 100) return "legacy";

  // D4 (6 Sep 2026) — Charlotte's definitive 41-code list, DB codes 201–241.
  if (code >= 200) {
    const display = code - 200;
    if (display >= 1 && display <= 7) return "circumstances";
    if (display >= 8 && display <= 26) return "income";
    if (display >= 27 && display <= 33) return "property";
    if (display >= 34 && display <= 37) return "documentation";
    if (display >= 38 && display <= 41) return "fees";
    return "other";
  }

  // The retired 101–137 generation (deprecated 6 Sep 2026) — kept so historic
  // recommendations bucket under the category they were picked from.
  const display = code - 100;
  if (display >= 1 && display <= 7) return "circumstances";
  if (display >= 8 && display <= 21) return "income";
  if (display >= 22 && display <= 27) return "property";
  if (display >= 28 && display <= 31) return "documentation";
  if (display >= 33 && display <= 37) return "fees";
  return "other";
}

/** The plain category label for a reason code (used by the settings table). */
export function categoryForCode(code: number): string {
  const key = categoryKeyForCode(code);
  return (
    REASON_CODE_CATEGORIES.find((c) => c.key === key)?.label ?? "Other"
  );
}

/**
 * The selector's group heading for a reason code — "1 – 7: Circumstances"
 * etc. (the range-prefixed form the recommendation selector renders; ranges
 * are the workbook DISPLAY numbers, i.e. DB code − 100). The "Other" and
 * "Legacy (deprecated)" buckets have no range prefix.
 */
export function groupHeadingForCode(code: number): string {
  const key = categoryKeyForCode(code);
  const cat = REASON_CODE_CATEGORIES.find((c) => c.key === key);
  if (!cat) return "Other";
  return cat.range ? `${cat.range}: ${cat.label}` : cat.label;
}

/** The ordered list of selector group headings (for stable group ordering). */
export const REASON_CODE_GROUP_HEADINGS: string[] = REASON_CODE_CATEGORIES.map(
  (c) => (c.range ? `${c.range}: ${c.label}` : c.label)
);
