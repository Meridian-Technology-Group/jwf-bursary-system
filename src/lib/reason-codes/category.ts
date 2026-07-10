/**
 * Epic 08 / CALC-09 — single source of truth for the reason-code → category
 * grouping. Both the recommendation selector (`reason-code-selector.tsx`,
 * `groupReasonCodes`) and the settings table (`settings/reason-code-table.tsx`,
 * `getCategory`) consume this util so the two UIs can never drift.
 *
 * CALC-09 (decision D4): the placeholder codes 1–35 are deprecated and the
 * client's definitive year-on-year list is seeded as DB codes 101–136, where
 * the workbook's own display number is `code − 100` (it also prefixes each
 * label). Grouping is therefore by display number:
 *
 *   1–7    Circumstances            (first assessment, no change, family
 *                                    member changes, divorce, bereavement,
 *                                    illness)
 *   8–21   Income & Employment
 *   22–27  Property & Assets
 *   28–31  Documentation & Compliance
 *   33–36  Fees & Adjustments
 *   else   Other                    (incl. display 32 "Other")
 *
 * Legacy codes (< 100) — the deprecated placeholders — bucket under
 * "Legacy (deprecated)", kept LAST in the ordered heading list. They never
 * appear in the selection picker (it is fed only active codes); the bucket
 * exists for settings/management views that show deprecated rows.
 */

/** Stable category keys (ordered) used to bucket reason codes. */
export const REASON_CODE_CATEGORIES = [
  { key: "circumstances", label: "Circumstances", range: "1 – 7" },
  { key: "income", label: "Income & Employment", range: "8 – 21" },
  { key: "property", label: "Property & Assets", range: "22 – 27" },
  { key: "documentation", label: "Documentation & Compliance", range: "28 – 31" },
  { key: "fees", label: "Fees & Adjustments", range: "33 – 36" },
  { key: "other", label: "Other", range: "" },
  { key: "legacy", label: "Legacy (deprecated)", range: "" },
] as const;

export type ReasonCodeCategoryKey =
  (typeof REASON_CODE_CATEGORIES)[number]["key"];

/** The category key for a reason code's numeric (DB) value. */
export function categoryKeyForCode(code: number): ReasonCodeCategoryKey {
  if (code < 100) return "legacy";
  const display = code - 100;
  if (display >= 1 && display <= 7) return "circumstances";
  if (display >= 8 && display <= 21) return "income";
  if (display >= 22 && display <= 27) return "property";
  if (display >= 28 && display <= 31) return "documentation";
  if (display >= 33 && display <= 36) return "fees";
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
