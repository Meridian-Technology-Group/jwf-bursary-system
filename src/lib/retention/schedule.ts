/**
 * Retention candidates and the upcoming schedule (Epic 23 T10).
 *
 * `dueCandidatesWhere(now)` is the SQL pre-filter: only applications whose
 * earliest possible stage is already due (by its closing / erasure date) — the
 * planner then decides exactly which stage. Fixes the old cron's traps: it took
 * the first 100 rows by `submittedAt` and filtered in memory (due rows past the
 * first 100 were never reached), and close-purged rows came back every week.
 * Callers page with `cursor` until a page comes back short.
 */

import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import { addYears, planRetention, RETENTION_YEARS, type RetentionPlan } from "@/lib/retention/policy";
import { RETENTION_RECORD_SELECT, toRetentionRecord, type RetentionRow } from "@/lib/retention/stages";

const NOT_FINISHED: Prisma.ApplicationWhereInput = {
  OR: [{ retentionStage: null }, { retentionStage: { not: "ASSESSMENT_PURGED" } }],
};

/** Applications with any retention anchor at all (the panel's universe). */
export const ANCHORED_WHERE: Prisma.ApplicationWhereInput = {
  AND: [
    NOT_FINISHED,
    {
      OR: [
        { bursaryAccount: { closedAt: { not: null } } },
        { bursaryAccountId: null, closedAt: { not: null } },
        { bursaryAccountId: null, assessment: { status: "CLOSED_ARCHIVED", archivedAt: { not: null } } },
        { retentionStage: "ANONYMISED" },
      ],
    },
  ],
};

/** Applications whose earliest possible stage is due by `now`. */
export function dueCandidatesWhere(now: Date): Prisma.ApplicationWhereInput {
  return {
    AND: [
      NOT_FINISHED,
      {
        OR: [
          { bursaryAccount: { closedAt: { lte: addYears(now, -RETENTION_YEARS.accountClosedFormDocs) } } },
          { bursaryAccountId: null, closedAt: { lte: now } },
          { bursaryAccountId: null, assessment: { status: "CLOSED_ARCHIVED", archivedAt: { lte: now } } },
          { retentionStage: "ANONYMISED", retentionStageAt: { lte: addYears(now, -RETENTION_YEARS.erasureAssessment) } },
        ],
      },
    ],
  };
}

export const PAGE_SIZE = 200;

/** One page of rows matching `where`, by id (cursor paging). */
export async function retentionPage(tx: Tx, where: Prisma.ApplicationWhereInput, cursor: string | null): Promise<RetentionRow[]> {
  return tx.application.findMany({
    where: cursor ? { AND: [where, { id: { gt: cursor } }] } : where,
    select: RETENTION_RECORD_SELECT,
    orderBy: { id: "asc" },
    take: PAGE_SIZE,
  });
}

export interface ScheduledItem {
  applicationId: string;
  reference: string;
  plan: RetentionPlan;
}

/** Every anchored application's plan, soonest first (the Retention panel; the dry-run's "next due"). */
export async function retentionSchedule(tx: Tx, now: Date): Promise<ScheduledItem[]> {
  const items: ScheduledItem[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page = await retentionPage(tx, ANCHORED_WHERE, cursor);
    for (const row of page) {
      const plan = planRetention(toRetentionRecord(row), now);
      if (plan.action !== "keep") items.push({ applicationId: row.id, reference: row.reference, plan });
    }
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1].id;
  }
  return sortSchedule(items);
}

/** Soonest due first; ties by reference. Pure. */
export function sortSchedule(items: readonly ScheduledItem[]): ScheduledItem[] {
  return [...items].sort(
    (a, b) => (a.plan.dueAt?.getTime() ?? Infinity) - (b.plan.dueAt?.getTime() ?? Infinity) || a.reference.localeCompare(b.reference),
  );
}

/** Dry-run / run summary counts per action. Pure. */
export function countByAction(plans: readonly RetentionPlan[]): Record<string, number> {
  return plans.reduce<Record<string, number>>((m, p) => ((m[p.action] = (m[p.action] ?? 0) + 1), m), {});
}
