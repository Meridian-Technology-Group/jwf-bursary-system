/**
 * Epic 08 — single source of truth for the reason-code numeric-range → category
 * grouping. Both the recommendation selector (`reason-code-selector.tsx`,
 * `groupReasonCodes`) and the settings table (`settings/reason-code-table.tsx`,
 * `getCategory`) previously hard-coded the SAME 1–9 / 10–19 / 20–29 / 30–39
 * buckets independently. When the real paperwork codes land (Decision D4) the
 * grouping may change; keeping one util means the swap touches one place and both
 * UIs stay in lockstep — they can never drift to wrong/`Other` headings.
 *
 * D4 swap path: when Charlotte supplies the real codes + their intended
 * grouping, edit ONLY this file (or extend it with a code→category lookup) and
 * re-seed via `seed:reference`. The placeholders keep working until then.
 */

/** Stable category keys (ordered) used to bucket reason codes. */
export const REASON_CODE_CATEGORIES = [
  { key: "income", label: "Income", range: "1 – 9" },
  { key: "property", label: "Property & Assets", range: "10 – 19" },
  { key: "family", label: "Family Circumstances", range: "20 – 29" },
  { key: "risk", label: "Risk Flags", range: "30 – 39" },
  { key: "other", label: "Other", range: "" },
] as const;

export type ReasonCodeCategoryKey =
  (typeof REASON_CODE_CATEGORIES)[number]["key"];

/** The category key for a reason code's numeric value. */
export function categoryKeyForCode(code: number): ReasonCodeCategoryKey {
  if (code >= 1 && code <= 9) return "income";
  if (code >= 10 && code <= 19) return "property";
  if (code >= 20 && code <= 29) return "family";
  if (code >= 30 && code <= 39) return "risk";
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
 * The selector's group heading for a reason code — "1 – 9: Income" etc. (the
 * range-prefixed form the recommendation selector renders). The "Other" bucket
 * has no range prefix.
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
