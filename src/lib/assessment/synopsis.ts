/**
 * Epic 06 — single assessment synopsis: consolidation logic.
 *
 * Pure TypeScript mirror of the backfill SQL in
 * prisma/migrations/20260606140000_assessment_synopsis/migration.sql. The two
 * MUST stay in lockstep: this function and the SQL produce the same output for
 * the same inputs (six labelled checklist blocks in canonical order, then the
 * recommendation family synopsis and summary, de-duped, blanks skipped).
 *
 * Kept as a standalone, dependency-free helper so it can be unit-tested without
 * a database and reused by the seed.
 */

/** Canonical ChecklistTab values, in display/backfill order. */
export const CHECKLIST_TAB_ORDER = [
  "BURSARY_DETAILS",
  "LIVING_CONDITIONS",
  "DEBT",
  "OTHER_FEES",
  "STAFF",
  "FINANCIAL_PROFILE",
] as const;

export type ChecklistTabKey = (typeof CHECKLIST_TAB_ORDER)[number];

/** Heading written for each tab — mirrors the assessment-checklist UI labels. */
export const CHECKLIST_TAB_HEADINGS: Record<ChecklistTabKey, string> = {
  BURSARY_DETAILS: "Bursary Assessment Details",
  LIVING_CONDITIONS: "Living Conditions / Other JWF Children",
  DEBT: "Debt Situation",
  OTHER_FEES: "Other Fees with the Foundation",
  STAFF: "Staff Situation",
  FINANCIAL_PROFILE: "Financial Profile Impact",
};

export interface ChecklistRow {
  tab: string;
  notes: string | null;
}

/** True when a string has non-whitespace content. */
function hasText(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Consolidate the eight legacy qualitative boxes into one synopsis string.
 *
 * - Checklist tabs are emitted in CHECKLIST_TAB_ORDER, each as
 *   `## <Heading>\n<notes>`, skipping blank/whitespace-only notes and unknown
 *   tab keys.
 * - The recommendation family synopsis is appended under `## Family Synopsis`.
 * - The recommendation summary is appended under `## Recommendation Summary`,
 *   UNLESS it is identical to the family synopsis (de-dupe).
 * - Blocks are joined by a blank line; the result is trimmed.
 * - Returns null when there is no content at all (so the column stays NULL).
 */
export function consolidateSynopsis(
  checklists: ChecklistRow[],
  familySynopsis: string | null,
  summary: string | null
): string | null {
  const blocks: string[] = [];

  for (const tab of CHECKLIST_TAB_ORDER) {
    const row = checklists.find((c) => c.tab === tab);
    if (row && hasText(row.notes)) {
      blocks.push(`## ${CHECKLIST_TAB_HEADINGS[tab]}\n${row.notes}`);
    }
  }

  if (hasText(familySynopsis)) {
    blocks.push(`## Family Synopsis\n${familySynopsis}`);
  }

  if (hasText(summary) && (summary ?? "") !== (familySynopsis ?? "")) {
    blocks.push(`## Recommendation Summary\n${summary}`);
  }

  const result = blocks.join("\n\n").trim();
  return result.length > 0 ? result : null;
}
