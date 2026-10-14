/**
 * Epic 21 #6 (CR-002 Phase 4) — the account's standing synopsis.
 *
 * Charlotte, 11 Oct 2026, on the two synopsis boxes: "the one at the top of the
 * admin page will be the generic one that sustains all years, and the one
 * displayed on the bursary calculation (6) page will only pertain to that
 * year's assessment".
 *
 * Rework (14 Oct 2026, her 13 Oct reply): ONE editable "Main synopsis" per
 * account (an `account_synopsis_entries` row of kind MAIN; one per account by
 * a partial unique index). It is pre-filled once and then belongs to staff:
 *
 *   - migrated accounts: the Grant Tracker synopsis (the toolkit writes it);
 *   - new awards: the first award lock copies that year's synopsis in, when
 *     the account has no MAIN yet. Later locks never overwrite it.
 *
 * Every edit is audited (`ACCOUNT_MAIN_SYNOPSIS_SAVED`), so its history is the
 * History tab; the card shows the current text only. "This year's synopsis"
 * (`Assessment.synopsis`) locks with the assessment (`isSynopsisLocked`).
 */

import type { AssessmentStatus } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";

export const MAIN_SYNOPSIS_MAX = 20000;

/** The text a lock seeds the MAIN entry with, or null when the synopsis is blank. */
export function mainSynopsisSeed(synopsis: string | null | undefined): string | null {
  const body = synopsis?.trim();
  return body ? body : null;
}

/**
 * Validates a staff edit of the main synopsis. Blank is allowed (staff may
 * clear it); only the length is capped. Returns the text to store, trimmed.
 */
export function checkMainSynopsisBody(
  body: string
): { ok: true; body: string } | { ok: false; error: string } {
  const b = body.trim();
  if (b.length > MAIN_SYNOPSIS_MAX) {
    return {
      ok: false,
      error: `The main synopsis is limited to ${MAIN_SYNOPSIS_MAX.toLocaleString("en-GB")} characters.`,
    };
  }
  return { ok: true, body: b };
}

/**
 * "This year's synopsis" locks with the assessment: once it reaches an Epic 18
 * post-assessment final state (NEW_AWARD, ROLLED_OVER, WAITING_LIST,
 * CLOSED_ARCHIVED), the set that already makes the recommendation form
 * read-only. Reversing the decision back to COMPLETED unlocks it.
 *
 * An allowlist, like `assessmentSaveLock` (assessment/gate.ts): the synopsis
 * stays editable while the assessment is worked and once stored as complete;
 * any other status, including one added later, is locked. Client-safe.
 */
const SYNOPSIS_EDITABLE_STATUSES: ReadonlySet<string> = new Set<AssessmentStatus>([
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
]);

export function isSynopsisLocked(status: AssessmentStatus | string | null | undefined): boolean {
  return status != null && !SYNOPSIS_EDITABLE_STATUSES.has(status);
}

export const SYNOPSIS_LOCKED_MESSAGE =
  "This year's synopsis is locked with the assessment. Reverse the decision " +
  "first if it needs to change, or use the main synopsis.";

/**
 * At an award lock: creates the account's MAIN entry from this year's
 * synopsis when the account has none. Never overwrites an existing MAIN (it is
 * staff's from then on). `skipDuplicates` makes a concurrent lock a no-op
 * against the one-MAIN-per-account index. Returns whether it wrote.
 */
export async function seedMainSynopsisAtLock(
  tx: Tx,
  params: {
    bursaryAccountId: string;
    synopsis: string | null | undefined;
    userId: string | null;
  }
): Promise<boolean> {
  const body = mainSynopsisSeed(params.synopsis);
  if (!body) return false;
  const existing = await tx.accountSynopsisEntry.findFirst({
    where: { bursaryAccountId: params.bursaryAccountId, kind: "MAIN" },
    select: { id: true },
  });
  if (existing) return false;
  const { count } = await tx.accountSynopsisEntry.createMany({
    data: [
      {
        bursaryAccountId: params.bursaryAccountId,
        kind: "MAIN",
        body,
        createdById: params.userId,
      },
    ],
    skipDuplicates: true,
  });
  return count > 0;
}
