/**
 * BURSARY ACTIVITY DASHBOARD (Epic 23 T9) — Charlotte's 6 Sep 2026 layout
 * (Dashboard.xlsx) — the pure shaping behind each panel. The query layer
 * (`src/lib/db/queries/dashboard`) loads plain rows; everything that decides
 * a number lives here, unit-tested.
 *
 * Her 6 Sep answers:
 *   1. ex-OP pupils go through the normal rolling-over process;
 *   2. award types — Whitgift JWF / WSP-JWF / WFA, Trinity JWF / TBF; the fund
 *      can change year to year;
 *   3. only the SPEND tables split by fund cohort; every workload count
 *      stays OP / TS / WS (D-19).
 *
 * Pure — no DB, no clock.
 */

import type {
  ApplicationFormStatus,
  ApplicationType,
  AssessmentStatus,
  AwardFundType,
  InvitationSituation,
  School,
} from "@prisma/client";
import { formatAcademicYearLabel, parseAcademicYearStart } from "@/lib/assessment/fee-year";

// ─── Years ────────────────────────────────────────────────────────────────────

/** "2026/27" → "2026/2027" (her display). Unparseable → as given. */
export function fullAcademicYear(roundAcademicYear: string): string {
  const start = parseAcademicYearStart(roundAcademicYear);
  return start == null ? roundAcademicYear : `${start}/${start + 1}`;
}

/** The tax year a round's assessments look at: the year before (2026/27 → 2025/2026). */
export function taxYearForRound(roundAcademicYear: string): string {
  const start = parseAcademicYearStart(roundAcademicYear);
  return start == null ? "" : `${start - 1}/${start}`;
}

/** The following round's academic year, "2026/27" → "2027/28". */
export function nextRoundAcademicYear(roundAcademicYear: string): string | null {
  const start = parseAcademicYearStart(roundAcademicYear);
  if (start == null) return null;
  return `${start + 1}/${String((start + 2) % 100).padStart(2, "0")}`;
}

/** The schedule-row label for a round, "2027/28" → "2027-28". */
export function scheduleLabelForRound(roundAcademicYear: string): string | null {
  const start = parseAcademicYearStart(roundAcademicYear);
  return start == null ? null : formatAcademicYearLabel(start);
}

// ─── Schools and cohorts ──────────────────────────────────────────────────────

export const DASHBOARD_SCHOOLS: readonly School[] = ["TRINITY", "WHITGIFT", "OP_PARTNER"];
export const SCHOOL_SHORT: Record<School, string> = { TRINITY: "TS", WHITGIFT: "WS", OP_PARTNER: "OP" };

export type PerSchool = Record<School, number>;

export function emptyPerSchool(): PerSchool {
  return { TRINITY: 0, WHITGIFT: 0, OP_PARTNER: 0 };
}

export function countBySchool<T>(rows: readonly T[], schoolOf: (r: T) => School | null | undefined, include: (r: T) => boolean = () => true): PerSchool {
  const out = emptyPerSchool();
  for (const r of rows) {
    const s = schoolOf(r);
    if (s && include(r)) out[s] += 1;
  }
  return out;
}

export function sumBySchool<T>(rows: readonly T[], schoolOf: (r: T) => School | null | undefined, value: (r: T) => number): PerSchool {
  const out = emptyPerSchool();
  for (const r of rows) {
    const s = schoolOf(r);
    if (s) out[s] += value(r);
  }
  return out;
}

/** TS and WS always; OP only where it has any (her sheet shows TS and WS). */
export function visibleSchools(...tables: readonly PerSchool[]): School[] {
  const op = tables.some((t) => t.OP_PARTNER !== 0);
  return op ? ["TRINITY", "WHITGIFT", "OP_PARTNER"] : ["TRINITY", "WHITGIFT"];
}

/** D-19: the spend cohorts. */
export type Cohort = "EX_OP" | "TS" | "TS_TBF" | "WS" | "WS_WFA" | "WS_PB";
export const COHORTS: readonly Cohort[] = ["EX_OP", "TS", "TS_TBF", "WS", "WS_WFA", "WS_PB"];
export const COHORT_LABELS: Record<Cohort, string> = {
  EX_OP: "ex-OP",
  TS: "TS",
  TS_TBF: "TS - TBF",
  WS: "WS",
  WS_WFA: "WS - WFA",
  WS_PB: "WS - Pastoral Boarders",
};

/**
 * D-19: ex-OP = school OP partner; TBF / WFA from the award's fund; pastoral
 * boarders = `migrationSource = MANUAL_PB` (the only pastoral marker that
 * exists); WS-WSP-JWF counts under WS.
 */
export function cohortOf(r: { school: School; awardFundType: AwardFundType | null; migrationSource: string | null }): Cohort {
  if (r.school === "OP_PARTNER") return "EX_OP";
  if (r.school === "TRINITY") return r.awardFundType === "TBF" ? "TS_TBF" : "TS";
  if (r.migrationSource === "MANUAL_PB") return "WS_PB";
  return r.awardFundType === "WFA" ? "WS_WFA" : "WS";
}

/** The committed-spend table's three groups (her sheet: ex-OP, TS, WS). */
export function spendGroupOf(c: Cohort): "exOp" | "ts" | "ws" {
  if (c === "EX_OP") return "exOp";
  return c === "TS" || c === "TS_TBF" ? "ts" : "ws";
}

export function percentOf(n: number, total: number): number | null {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : null;
}

// ─── Assessment workload buckets ─────────────────────────────────────────────

export type WorkloadBucket = "waiting" | "paused" | "completed" | null;

const DONE: readonly AssessmentStatus[] = ["COMPLETED", "NEW_AWARD", "ROLLED_OVER", "WAITING_LIST", "CLOSED_ARCHIVED"];

/**
 * Her three assessment rows, for a submitted form: waiting to be started (no
 * assessment, Not started or In progress — not finished and not paused),
 * paused, completed (stored as complete or any final state). An unsubmitted
 * form is in none.
 */
export function workloadBucket(app: { formStatus: ApplicationFormStatus; assessmentStatus: AssessmentStatus | null }): WorkloadBucket {
  if (app.assessmentStatus && DONE.includes(app.assessmentStatus)) return "completed";
  if (app.formStatus !== "SUBMITTED") return null;
  if (app.assessmentStatus === "PAUSED") return "paused";
  return "waiting";
}

// ─── Band 1 — applications & assessments management ─────────────────────────

export interface Band1Application {
  school: School;
  applicationType: ApplicationType;
  formStatus: ApplicationFormStatus;
  assessmentStatus: AssessmentStatus | null;
  assessmentSchool: School | null;
}

export interface Band1Invitation {
  school: School | null;
  situation: InvitationSituation | null;
  bursaryAccountId: string | null;
}

/** A "new application" invitation: a first-year family (no account; NEW / INTERNAL). */
export function isNewApplicationInvitation(i: Band1Invitation): boolean {
  return i.situation !== "ROLLING_OVER" && i.bursaryAccountId == null;
}

export interface Band1 {
  newInvitesSent: PerSchool;
  newReceived: PerSchool;
  rollingDue: PerSchool;
  total: PerSchool;
  waiting: PerSchool;
  paused: PerSchool;
  completed: PerSchool;
  schools: School[];
  totals: { newInvitesSent: number; newReceived: number };
}

const total = (p: PerSchool) => p.TRINITY + p.WHITGIFT + p.OP_PARTNER;

/**
 * `rollingDueSchools` is one school per rolling-over account due in the round
 * (its rolling-over application, or its still-scheduled row).
 */
export function shapeBand1(
  applications: readonly Band1Application[],
  invitations: readonly Band1Invitation[],
  rollingDueSchools: readonly School[],
): Band1 {
  const newInvitesSent = countBySchool(invitations, (i) => i.school, isNewApplicationInvitation);
  const newReceived = countBySchool(applications, (a) => a.school, (a) => a.applicationType === "NEW" && a.formStatus === "SUBMITTED");
  const rollingDue = countBySchool(rollingDueSchools, (s) => s);
  const totalApps = emptyPerSchool();
  for (const s of DASHBOARD_SCHOOLS) totalApps[s] = newInvitesSent[s] + rollingDue[s];
  const school = (a: Band1Application) => a.assessmentSchool ?? a.school;
  const bucket = (b: WorkloadBucket) => (a: Band1Application) =>
    workloadBucket({ formStatus: a.formStatus, assessmentStatus: a.assessmentStatus }) === b;
  const waiting = countBySchool(applications, school, bucket("waiting"));
  const paused = countBySchool(applications, school, bucket("paused"));
  const completed = countBySchool(applications, school, bucket("completed"));
  return {
    newInvitesSent,
    newReceived,
    rollingDue,
    total: totalApps,
    waiting,
    paused,
    completed,
    schools: visibleSchools(newInvitesSent, newReceived, rollingDue, waiting, paused, completed),
    totals: { newInvitesSent: total(newInvitesSent), newReceived: total(newReceived) },
  };
}

// ─── Band 2 — outcomes, new & internal applications ──────────────────────────

export interface Band2Application {
  school: School;
  assessmentSchool: School | null;
  applicationType: ApplicationType;
  assessmentStatus: AssessmentStatus | null;
  closedAt: Date | null;
  closeReasonLabel: string | null;
  entryYear: number | null;
  bursarySpendBeforeVat: number | null;
}

export interface SpendCell {
  spend: number;
  awards: number;
}

export interface Band2 {
  newAwards: PerSchool;
  closedNoAward: PerSchool;
  /** Awards whose bursary starts in the round's own academic year (internal bursaries). */
  spendCurrentYear: Record<School, SpendCell>;
  /** Awards starting the following academic year (new applications). */
  spendNextYear: Record<School, SpendCell>;
  closedReasons: { label: string; share: number }[];
  closedTotal: number;
  schools: School[];
}

/** "Closed account – Family relocating" → "Family relocating" (her mock-up drops the prefix). */
export function closeReasonShortLabel(label: string): string {
  return label.replace(/^Closed account\s*[–-]\s*/i, "").trim();
}

export function shapeBand2(applications: readonly Band2Application[], roundStartYear: number): Band2 {
  const newApps = applications.filter((a) => a.applicationType === "NEW");
  const school = (a: Band2Application) => a.assessmentSchool ?? a.school;
  const awarded = newApps.filter((a) => a.assessmentStatus === "NEW_AWARD");
  const closed = newApps.filter(
    (a) => a.assessmentStatus !== "NEW_AWARD" && (a.closedAt != null || a.assessmentStatus === "CLOSED_ARCHIVED"),
  );
  const cells = (rows: readonly Band2Application[]) => {
    const out = { TRINITY: { spend: 0, awards: 0 }, WHITGIFT: { spend: 0, awards: 0 }, OP_PARTNER: { spend: 0, awards: 0 } };
    for (const a of rows) {
      out[school(a)].spend += a.bursarySpendBeforeVat ?? 0;
      out[school(a)].awards += 1;
    }
    for (const s of DASHBOARD_SCHOOLS) out[s].spend = Math.round(out[s].spend * 100) / 100;
    return out;
  };
  const current = awarded.filter((a) => a.entryYear == null || a.entryYear <= roundStartYear);
  const next = awarded.filter((a) => a.entryYear != null && a.entryYear > roundStartYear);

  const byReason = new Map<string, number>();
  for (const a of closed) {
    const label = closeReasonShortLabel(a.closeReasonLabel ?? "No reason recorded");
    byReason.set(label, (byReason.get(label) ?? 0) + 1);
  }
  const closedReasons = Array.from(byReason.entries())
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, 5)
    .map(([label, n]) => ({ label, share: n / closed.length }));

  const newAwards = countBySchool(awarded, school);
  const closedNoAward = countBySchool(closed, school);
  return {
    newAwards,
    closedNoAward,
    spendCurrentYear: cells(current),
    spendNextYear: cells(next),
    closedReasons,
    closedTotal: closed.length,
    schools: visibleSchools(newAwards, closedNoAward),
  };
}

// ─── Band 3 — outcomes, rolling-over ─────────────────────────────────────────

export interface ScheduledAccount {
  accountId: string;
  school: School;
  awardFundType: AwardFundType | null;
  migrationSource: string | null;
  accountClosed: boolean;
}

export interface NextRoundApplication {
  accountId: string | null;
  applicationType: ApplicationType;
  formStatus: ApplicationFormStatus;
  assessmentStatus: AssessmentStatus | null;
  bursarySpendBeforeVat: number | null;
  reasonCodes: readonly { code: number; label: string }[];
}

export interface Band3 {
  cohorts: Record<Cohort, number>;
  scheduledTotal: number;
  progress: {
    sent: number;
    received: number;
    waiting: number;
    paused: number;
    closed: number;
    completedWithAward: number;
  };
  committedSpend: { exOp: number; ts: number; ws: number };
  committedCount: number;
  yoyChanges: { label: string; count: number }[];
  yoyCount: number;
}

export function shapeBand3(
  scheduled: readonly ScheduledAccount[],
  rollingInvitesSent: number,
  applications: readonly NextRoundApplication[],
): Band3 {
  const cohorts = Object.fromEntries(COHORTS.map((c) => [c, 0])) as Record<Cohort, number>;
  const cohortByAccount = new Map<string, Cohort>();
  for (const a of scheduled) {
    const c = cohortOf(a);
    cohorts[c] += 1;
    cohortByAccount.set(a.accountId, c);
  }
  const rolling = applications.filter((a) => a.applicationType === "ROLLING_OVER");
  const bucket = (b: WorkloadBucket) =>
    rolling.filter((a) => workloadBucket({ formStatus: a.formStatus, assessmentStatus: a.assessmentStatus }) === b).length;
  const done = rolling.filter((a) => a.assessmentStatus === "ROLLED_OVER");

  const committedSpend = { exOp: 0, ts: 0, ws: 0 };
  for (const a of done) {
    const c = a.accountId ? cohortByAccount.get(a.accountId) : undefined;
    if (c) committedSpend[spendGroupOf(c)] += a.bursarySpendBeforeVat ?? 0;
  }
  for (const k of ["exOp", "ts", "ws"] as const) committedSpend[k] = Math.round(committedSpend[k] * 100) / 100;

  const yoy = new Map<string, number>();
  for (const a of done) {
    for (const r of a.reasonCodes) {
      const label = `${r.code} - ${r.label}`;
      yoy.set(label, (yoy.get(label) ?? 0) + 1);
    }
  }
  const yoyChanges = Array.from(yoy.entries())
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  return {
    cohorts,
    scheduledTotal: scheduled.length,
    progress: {
      sent: rollingInvitesSent,
      received: rolling.filter((a) => a.formStatus === "SUBMITTED" || done.includes(a)).length,
      waiting: bucket("waiting"),
      paused: bucket("paused"),
      closed: scheduled.filter((a) => a.accountClosed).length,
      completedWithAward: done.length,
    },
    committedSpend,
    committedCount: done.length,
    yoyChanges,
    yoyCount: Array.from(yoy.values()).reduce((t, n) => t + n, 0),
  };
}
