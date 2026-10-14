/**
 * Epic 21 #6 (rework, 14 Oct 2026) — read path for the account's main
 * synopsis (the card at the top of the ASSESSMENT ADMIN tab). Runs under the
 * caller's RLS context: staff only (`account_synopsis_entries_select`).
 */

import type { Tx } from "@/lib/db/prisma";

export interface MainSynopsis {
  body: string;
  updatedAt: Date;
}

/** The account's MAIN entry, or null when it has none yet. */
export async function getMainSynopsis(
  tx: Tx,
  bursaryAccountId: string
): Promise<MainSynopsis | null> {
  return tx.accountSynopsisEntry.findFirst({
    where: { bursaryAccountId, kind: "MAIN" },
    select: { body: true, updatedAt: true },
  });
}
