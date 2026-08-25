/**
 * CH-43 — postcode district → area resolution for the assessment summary.
 *
 * Charlotte's ask (24 Aug 2026): *"the assessor types : SM4, and the field
 * within the summary view below reports : SM4-MORDEN"*.
 *
 * Two deliberate design points, both from her own spreadsheet:
 *
 *  1. **Nothing is rejected.** Her sheet ends with a `*** | OTHER` catch-all
 *     row, so a district she has not listed resolves to `OTHER` rather than
 *     failing validation. Her list is Croydon and its surrounds; an applicant
 *     from further afield is expected, not an error.
 *  2. **The stored value is what the assessor typed.** The area is derived at
 *     read time from reference data, never persisted alongside it, so
 *     correcting her lookup table fixes every existing assessment at once
 *     instead of leaving stale pairs behind.
 *
 * Pure module — no DB, no React. The caller supplies the lookup rows.
 */

import { POSTCODE_AREA_FALLBACK } from "../../../prisma/seed-data/postcode-areas";

export { POSTCODE_AREA_FALLBACK };

export interface PostcodeAreaRow {
  district: string;
  area: string;
}

/**
 * Normalises assessor input to a district key: uppercase, whitespace stripped.
 *
 * Deliberately tolerant, because this is a free-text field an assessor types in
 * a hurry. `" sm4 "`, `"Sm4"` and `"SM4"` are the same district. A full postcode
 * is also accepted — `"SM4 5AB"` yields `"SM4"` — because typing the whole thing
 * is the obvious mistake to make and refusing it would be pedantry.
 */
export function normalisePostcodeDistrict(raw: string | null | undefined): string {
  if (!raw) return "";
  const collapsed = raw.replace(/\s+/g, "").toUpperCase();

  // Splitting a space-less full postcode is genuinely ambiguous from the front:
  // "SM45AB" could read as SM4 + 5AB or SM45 + AB, and a greedy outward-code
  // pattern picks the wrong one ("SM45A"). It is unambiguous from the BACK,
  // because a UK inward code is always exactly three characters — one digit
  // then two letters. So if the tail looks like an inward code, drop it; what
  // remains is the district.
  if (collapsed.length > 3 && /\d[A-Z]{2}$/.test(collapsed)) {
    return collapsed.slice(0, -3);
  }
  return collapsed;
}

/** The area for a district, or `OTHER` when she has not listed it. */
export function resolvePostcodeArea(
  district: string | null | undefined,
  rows: readonly PostcodeAreaRow[]
): string {
  const key = normalisePostcodeDistrict(district);
  if (!key) return POSTCODE_AREA_FALLBACK;
  return rows.find((r) => r.district === key)?.area ?? POSTCODE_AREA_FALLBACK;
}

/**
 * The joined label her summary shows — `SM4-MORDEN`.
 *
 * Returns `null` for empty input so the caller can render an em-dash rather
 * than a bare `-OTHER`, which would look like a bug on an unfilled assessment.
 */
export function formatPostcodeAreaLabel(
  district: string | null | undefined,
  rows: readonly PostcodeAreaRow[]
): string | null {
  const key = normalisePostcodeDistrict(district);
  if (!key) return null;
  return `${key}-${resolvePostcodeArea(key, rows)}`;
}
