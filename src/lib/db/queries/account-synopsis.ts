/**
 * Epic 21 #6 — read path for the account's standing synopsis (the timeline
 * at the top of the ASSESSMENT ADMIN tab). Runs under the caller's RLS
 * context: staff only (`account_synopsis_entries_select`).
 */

import type { Tx } from "@/lib/db/prisma";
import {
  orderSynopsisTimeline,
  type SynopsisTimelineEntry,
} from "@/lib/bursary-accounts/standing-synopsis";

export interface AccountSynopsisTimelineRow extends SynopsisTimelineEntry {
  /** The YEAR entry's assessment's application, for "edit in that year". */
  applicationId: string | null;
  /** "First Last" of the author; null for system / migration entries. */
  authorName: string | null;
  updatedAt: Date;
}

export async function getAccountSynopsisTimeline(
  tx: Tx,
  bursaryAccountId: string
): Promise<AccountSynopsisTimelineRow[]> {
  const entries = await tx.accountSynopsisEntry.findMany({
    where: { bursaryAccountId },
    select: {
      id: true,
      kind: true,
      academicYear: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      assessment: { select: { applicationId: true } },
    },
  });

  const authorIds = Array.from(
    new Set(entries.map((e) => e.createdById).filter((id): id is string => !!id))
  );
  const authors =
    authorIds.length > 0
      ? await tx.profile.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const nameById = new Map(
    authors.map((a) => [a.id, [a.firstName, a.lastName].filter(Boolean).join(" ") || null])
  );

  return orderSynopsisTimeline(
    entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      academicYear: e.academicYear,
      body: e.body,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      applicationId: e.assessment?.applicationId ?? null,
      authorName: e.createdById ? (nameById.get(e.createdById) ?? null) : null,
    }))
  );
}
