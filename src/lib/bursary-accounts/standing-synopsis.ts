/**
 * Epic 21 #6 (CR-002 Phase 4) — the account's standing synopsis.
 *
 * Charlotte, 11 Oct 2026, on the two synopsis boxes: "the one at the top of the
 * admin page will be the generic one that sustains all years, and the one
 * displayed on the bursary calculation (6) page will only pertain to that
 * year's assessment". This module owns the all-years timeline:
 *
 *   - a YEAR entry per locked assessment, from that year's synopsis, written at
 *     the award lock and replaced on a re-lock (D-6), so it is idempotent;
 *   - NOTE entries staff add at any time (ADMIN may edit; nobody deletes).
 *
 * The YEAR entry and `Assessment.synopsis` never disagree: editing that year's
 * synopsis after the lock updates its entry (`saveSynopsis`).
 */

import type { Tx } from "@/lib/db/prisma";

/** The YEAR entry a lock writes, or null when the synopsis is blank. */
export function yearEntryFromLock(params: {
  synopsis: string | null | undefined;
  academicYear: string;
}): { body: string; academicYear: string } | null {
  const body = params.synopsis?.trim();
  if (!body) return null;
  return { body, academicYear: params.academicYear };
}

export interface SynopsisTimelineEntry {
  id: string;
  kind: "YEAR" | "NOTE";
  academicYear: string | null;
  body: string;
  createdAt: Date;
}

/**
 * Newest first. Entries keep the place they were created at, so re-locking a
 * year (which replaces its body) does not jump it to the top.
 */
export function orderSynopsisTimeline<T extends SynopsisTimelineEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id)
  );
}

/**
 * Upserts the YEAR entry for one assessment at its award lock. Skips a blank
 * synopsis (an existing entry is left as it was). Returns whether it wrote.
 */
export async function upsertYearSynopsisEntry(
  tx: Tx,
  params: {
    bursaryAccountId: string;
    assessmentId: string;
    academicYear: string;
    synopsis: string | null | undefined;
    userId: string | null;
  }
): Promise<boolean> {
  const entry = yearEntryFromLock(params);
  if (!entry) return false;
  await tx.accountSynopsisEntry.upsert({
    where: { assessmentId: params.assessmentId },
    create: {
      bursaryAccountId: params.bursaryAccountId,
      kind: "YEAR",
      assessmentId: params.assessmentId,
      academicYear: entry.academicYear,
      body: entry.body,
      createdById: params.userId,
    },
    update: { body: entry.body, academicYear: entry.academicYear },
  });
  return true;
}
