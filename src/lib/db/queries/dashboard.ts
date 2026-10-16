/**
 * BURSARY ACTIVITY DASHBOARD queries (Epic 23 T9). A handful of set-wise
 * reads for the current round (`getActiveRound`) and the next one (the
 * round for the following academic year, in any status, DRAFT included);
 * every number is decided by the pure shapers in `src/lib/dashboard/shape`.
 *
 * Runs inside the caller's staff RLS transaction.
 */

import type { School } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import { getActiveRound } from "@/lib/db/queries/reports";
import { parseAcademicYearStart } from "@/lib/assessment/fee-year";
import { rollingOverWindowFor } from "@/lib/bursary-accounts/schedule-dates";
import {
  fullAcademicYear,
  nextRoundAcademicYear,
  scheduleLabelForRound,
  shapeBand1,
  shapeBand2,
  shapeBand3,
  taxYearForRound,
  type Band1,
  type Band2,
  type Band3,
} from "@/lib/dashboard/shape";
import {
  chooseRealOrSample,
  readSample,
  SAMPLE_KEYS,
  type RealOrSample,
  type SampleKey,
} from "@/lib/dashboard/sample-data";

const num = (v: unknown) => (v == null ? null : Number(v));

export interface DashboardData {
  current: {
    roundId: string;
    academicYear: string;
    academicYearLabel: string;
    taxYear: string;
  } | null;
  band1: Band1 | null;
  band2: Band2 | null;
  closedReasons: RealOrSample<{ label: string; share: number }[]> | null;
  next: {
    roundId: string | null;
    academicYearLabel: string;
    taxYear: string;
    opensOn: Date;
    submitBy: Date;
    assessmentsDoneBy: Date | null;
  } | null;
  band3: Band3 | null;
  committedSpend: RealOrSample<{ exOp: number; ts: number; ws: number }> | null;
  yoyChanges: RealOrSample<{ label: string; count: number }[]> | null;
}

async function loadSamples(tx: Tx) {
  const rows = await tx.dashboardSampleData.findMany({ select: { key: true, payload: true } });
  const byKey = new Map(rows.map((r) => [r.key, r.payload]));
  return {
    closed_reasons_top5: readSample("closed_reasons_top5", byKey.get("closed_reasons_top5")),
    yoy_changes_top10: readSample("yoy_changes_top10", byKey.get("yoy_changes_top10")),
    rolling_committed_spend: readSample("rolling_committed_spend", byKey.get("rolling_committed_spend")),
  };
}

export async function getDashboardData(tx: Tx): Promise<DashboardData> {
  const samples = await loadSamples(tx);
  const active = await getActiveRound(tx);
  if (!active) {
    return { current: null, band1: null, band2: null, closedReasons: null, next: null, band3: null, committedSpend: null, yoyChanges: null };
  }
  const start = parseAcademicYearStart(active.academicYear) ?? 0;

  // ── Current round ──────────────────────────────────────────────────────────
  const [applications, invitations] = await Promise.all([
    tx.application.findMany({
      where: { roundId: active.id, archivedAt: null },
      select: {
        school: true,
        applicationType: true,
        formStatus: true,
        closedAt: true,
        entryYear: true,
        bursaryAccountId: true,
        closeReason: { select: { label: true } },
        assessment: {
          select: {
            status: true,
            assessmentSchool: true,
            recommendation: { select: { bursarySpendBeforeVat: true } },
          },
        },
      },
    }),
    tx.invitation.findMany({
      where: { roundId: active.id },
      select: { school: true, situation: true, bursaryAccountId: true },
    }),
  ]);

  // Rolling-over applications due: one per account — its rolling-over
  // application in the round, or its still-scheduled row for the year.
  const label = scheduleLabelForRound(active.academicYear);
  const dueSchools = new Map<string, School>();
  for (const a of applications) {
    if (a.applicationType === "ROLLING_OVER" && a.bursaryAccountId) dueSchools.set(a.bursaryAccountId, a.school);
  }
  if (label) {
    const rows = await tx.bursaryScheduleEntry.findMany({
      where: { academicYear: label, scheduleYear: { gte: 2 }, applicationId: null },
      select: { bursaryAccountId: true, bursaryAccount: { select: { school: true } } },
    });
    for (const r of rows) if (!dueSchools.has(r.bursaryAccountId)) dueSchools.set(r.bursaryAccountId, r.bursaryAccount.school);
  }

  const band1 = shapeBand1(
    applications.map((a) => ({
      school: a.school,
      applicationType: a.applicationType,
      formStatus: a.formStatus,
      assessmentStatus: a.assessment?.status ?? null,
      assessmentSchool: a.assessment?.assessmentSchool ?? null,
    })),
    invitations,
    Array.from(dueSchools.values()),
  );
  const band2 = shapeBand2(
    applications.map((a) => ({
      school: a.school,
      assessmentSchool: a.assessment?.assessmentSchool ?? null,
      applicationType: a.applicationType,
      assessmentStatus: a.assessment?.status ?? null,
      closedAt: a.closedAt,
      closeReasonLabel: a.closeReason?.label ?? null,
      entryYear: a.entryYear,
      bursarySpendBeforeVat: num(a.assessment?.recommendation?.bursarySpendBeforeVat),
    })),
    start,
  );

  // ── Next round (any status, DRAFT included) ───────────────────────────────
  const nextYear = nextRoundAcademicYear(active.academicYear);
  const nextRound = nextYear
    ? await tx.round.findUnique({
        where: { academicYear: nextYear },
        select: {
          id: true,
          decisionDate: true,
          windows: { where: { scenario: "RA" }, select: { opensOn: true, submitBy: true } },
        },
      })
    : null;
  const nextLabel = nextYear ? scheduleLabelForRound(nextYear) : null;
  const window = rollingOverWindowFor(start + 1, nextRound?.windows[0] ?? null);

  const scheduled = nextLabel
    ? await tx.bursaryScheduleEntry.findMany({
        where: { academicYear: nextLabel, scheduleYear: { gte: 2 } },
        select: {
          bursaryAccountId: true,
          bursaryAccount: {
            select: {
              school: true,
              status: true,
              applications: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { migrationSource: true, assessment: { select: { awardFundType: true } } },
              },
            },
          },
        },
      })
    : [];

  const [nextApps, rollingInvites] = nextRound
    ? await Promise.all([
        tx.application.findMany({
          where: { roundId: nextRound.id, archivedAt: null },
          select: {
            bursaryAccountId: true,
            applicationType: true,
            formStatus: true,
            assessment: {
              select: {
                status: true,
                recommendation: {
                  select: {
                    bursarySpendBeforeVat: true,
                    reasonCodes: { select: { reasonCode: { select: { code: true, label: true } } } },
                  },
                },
              },
            },
          },
        }),
        tx.invitation.count({
          where: { roundId: nextRound.id, OR: [{ situation: "ROLLING_OVER" }, { bursaryAccountId: { not: null } }] },
        }),
      ])
    : [[], 0];

  const band3 = shapeBand3(
    scheduled.map((s) => ({
      accountId: s.bursaryAccountId,
      school: s.bursaryAccount.school,
      awardFundType: s.bursaryAccount.applications[0]?.assessment?.awardFundType ?? null,
      migrationSource: s.bursaryAccount.applications[0]?.migrationSource ?? null,
      accountClosed: s.bursaryAccount.status === "CLOSED",
    })),
    rollingInvites,
    nextApps.map((a) => ({
      accountId: a.bursaryAccountId,
      applicationType: a.applicationType,
      formStatus: a.formStatus,
      assessmentStatus: a.assessment?.status ?? null,
      bursarySpendBeforeVat: num(a.assessment?.recommendation?.bursarySpendBeforeVat),
      reasonCodes: a.assessment?.recommendation?.reasonCodes.map((r) => r.reasonCode) ?? [],
    })),
  );

  return {
    current: {
      roundId: active.id,
      academicYear: active.academicYear,
      academicYearLabel: fullAcademicYear(active.academicYear),
      taxYear: taxYearForRound(active.academicYear),
    },
    band1,
    band2,
    closedReasons: chooseRealOrSample(band2.closedTotal, band2.closedReasons, samples.closed_reasons_top5.rows),
    next: nextYear
      ? {
          roundId: nextRound?.id ?? null,
          academicYearLabel: fullAcademicYear(nextYear),
          taxYear: taxYearForRound(nextYear),
          opensOn: window.opensOn,
          submitBy: window.submitBy,
          assessmentsDoneBy: nextRound?.decisionDate ?? null,
        }
      : null,
    band3,
    committedSpend: chooseRealOrSample(band3.committedCount, band3.committedSpend, samples.rolling_committed_spend),
    yoyChanges: chooseRealOrSample(band3.yoyCount, band3.yoyChanges, samples.yoy_changes_top10.rows),
  };
}

/** Settings → Dashboard sample data: the three payloads as stored (or her defaults). */
export async function getDashboardSamples(tx: Tx) {
  return loadSamples(tx);
}

export const DASHBOARD_SAMPLE_KEYS: readonly SampleKey[] = SAMPLE_KEYS;
