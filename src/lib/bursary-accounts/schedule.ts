/**
 * Epic 10 — forward-schedule generation for a rolling bursary account.
 *
 * On AWARD an account is promoted ACTIVE and a multi-year schedule of future
 * assessment rounds is generated — the illustration's Year 1..N grid. This
 * module owns:
 *   - the horizon calculation (D19 default: years to the child's final eligible
 *     school year), and
 *   - the per-year row generation (academicYear / availableOn / requiredBy /
 *     showOnPortal defaults), IDEMPOTENT and re-runnable (the "Regenerate
 *     Schedule" button) so re-awarding never duplicates rows and never rewrites
 *     a RECEIVED year.
 *
 * Date policy (D19 default): each future year's `availableOn`/`requiredBy`
 * derive from the award round's open/close dates, shifted forward one academic
 * year per schedule year. Epic 03 owns the per-round date model; when a future
 * year is materialised into a real Round the entry is linked via `roundId` and
 * the round's own dates take over. Until then these are the planned dates.
 *
 * Show/Hide on portal (Epic 21 #5, D-2): every year of the award is shown by
 * default, and the tick is the admin's "hide this year from the family"
 * switch. It governs the portal home page and the calendar alike. (It used to
 * default on for years 1–2 only, which hid years 3+ from every family once the
 * home page obeyed it.)
 *
 * Epic 21 #4: an ADMIN can end the schedule after a year (a conditional
 * bursary) or add a year back. The account's `scheduleEndYear` caps the
 * horizon (`effectiveHorizon`) so neither Regenerate nor an award lock can
 * re-create an ended year; `planEndAfterYear` / `planAddYear` are the pure
 * decisions behind the two admin actions.
 */

import { finalEligibleSchoolYear } from "@/lib/schools";
import type { Tx } from "@/lib/db/prisma";
import type { EntryYearGroup, School, ScheduleEntryStatus } from "@prisma/client";
import {
  parseAcademicYearStart,
  formatAcademicYearLabel,
} from "@/lib/assessment/fee-year";
// Single source of truth for group → school-year (CH-26 added Y8/Y10/Y11/Y13);
// OTHER / null / unrecognised → null and the caller falls back to the default.
import { schoolYearForEntryYearGroup as schoolYearForGroup } from "@/lib/assessment/schooling-years";

/**
 * The final school year a bursary can run to at Trinity and Whitgift (Year 13 /
 * Upper Sixth). Per-school: `finalEligibleSchoolYear` (S9: OP ends at Year 11).
 */
export const FINAL_ELIGIBLE_SCHOOL_YEAR = 13;

/** Hard ceiling on generated years, so a bad entry-year never explodes the grid. */
export const MAX_SCHEDULE_YEARS = 8;

/**
 * D19 horizon: number of assessment years to generate, counting the award year
 * as Year 1. Defaults to "years to the final eligible school year" derived from
 * the entry year-group, clamped to [1, MAX_SCHEDULE_YEARS]. When the group is
 * OTHER/unknown, falls back to `fallback` (default MAX_SCHEDULE_YEARS so the
 * grid is generous and the admin trims via Regenerate rather than under-running).
 */
export function resolveScheduleHorizon(
  entryYearGroup: EntryYearGroup | null,
  fallback: number = MAX_SCHEDULE_YEARS,
  school: School | null = null
): number {
  const startYear = schoolYearForGroup(entryYearGroup);
  if (startYear == null) {
    return Math.min(Math.max(fallback, 1), MAX_SCHEDULE_YEARS);
  }
  // Inclusive of both the entry year and the final year.
  const years = finalEligibleSchoolYear(school) - startYear + 1;
  return Math.min(Math.max(years, 1), MAX_SCHEDULE_YEARS);
}

/**
 * Epic 21 #4 — the horizon after an ADMIN's "End after this year": the
 * natural horizon, capped at `scheduleEndYear` when one is set (never below 1).
 */
export function effectiveHorizon(natural: number, scheduleEndYear: number | null | undefined): number {
  if (scheduleEndYear == null) return natural;
  return Math.max(1, Math.min(natural, scheduleEndYear));
}

/** A schedule row as the end/add planners see it. */
export interface PlannerRow {
  id: string;
  scheduleYear: number;
  academicYear: string;
  status: ScheduleEntryStatus;
}

export type EndAfterYearPlan =
  | { ok: true; deleteIds: string[]; removedYears: string[] }
  | { ok: false; reason: string };

/**
 * Epic 21 #4 — "End after this year": every row after `thisYear` goes, but
 * only if none has started (an application exists or it was received). Refuses
 * naming the first year that has, or when there is nothing after this year.
 */
export function planEndAfterYear(rows: readonly PlannerRow[], thisYear: number): EndAfterYearPlan {
  const later = rows
    .filter((r) => r.scheduleYear > thisYear)
    .sort((a, b) => a.scheduleYear - b.scheduleYear);
  if (later.length === 0) {
    return { ok: false, reason: "There are no later years to remove: the schedule already ends with this year." };
  }
  const started = later.find((r) => r.status !== "SCHEDULED");
  if (started) {
    return {
      ok: false,
      reason: `${started.academicYear} has already started (its application exists or was received), so the schedule can't end before it.`,
    };
  }
  return {
    ok: true,
    deleteIds: later.map((r) => r.id),
    removedYears: later.map((r) => r.academicYear),
  };
}

export type AddYearPlan = { ok: true; scheduleYear: number } | { ok: false; reason: string };

/**
 * Epic 21 #4 — "Add a year": the year after the last one, refused past the
 * natural horizon (no Year 14; Year 11 at the OP partnering school).
 */
export function planAddYear(
  rows: readonly Pick<PlannerRow, "scheduleYear">[],
  naturalHorizon: number,
  school: School | null
): AddYearPlan {
  const next = rows.reduce((max, r) => Math.max(max, r.scheduleYear), 0) + 1;
  if (next > naturalHorizon) {
    return {
      ok: false,
      reason: `This pupil's bursary already runs to their final eligible year (Year ${finalEligibleSchoolYear(school)}), so no year can be added.`,
    };
  }
  return { ok: true, scheduleYear: next };
}

/**
 * "This year" on the admin page = the schedule row of the application being
 * viewed: linked by `applicationId`, else matched on its round's academic year
 * (rows say "2026-27", rounds "2026/27").
 */
export function findThisYearRow<T extends PlannerRow & { applicationId: string | null }>(
  rows: readonly T[],
  applicationId: string,
  roundAcademicYear: string
): T | null {
  const start = parseAcademicYearStart(roundAcademicYear);
  return (
    rows.find((r) => r.applicationId === applicationId) ??
    rows.find((r) => start != null && parseAcademicYearStart(r.academicYear) === start) ??
    null
  );
}

/** What the admin page's "End after this year" button can do. */
export type ScheduleEndControl =
  | { enabled: true; thisYear: string; removedYears: string[] }
  | { enabled: false; why: string };

/** What the admin page's "Add a year" button can do. */
export type ScheduleAddControl =
  | { enabled: true; addedYear: string; reopens: boolean }
  | { enabled: false; why: string };

/**
 * Epic 21 #4 — the state of the two admin-page buttons, from the same planners
 * the actions run, so a button is only enabled when its action would succeed.
 */
export function scheduleEditControls(params: {
  rows: readonly (PlannerRow & { applicationId: string | null })[];
  applicationId: string;
  roundAcademicYear: string;
  firstAssessmentYear: string;
  naturalHorizon: number;
  school: School | null;
  accountClosed: boolean;
}): { end: ScheduleEndControl; add: ScheduleAddControl } {
  const thisRow = findThisYearRow(params.rows, params.applicationId, params.roundAcademicYear);
  let end: ScheduleEndControl;
  if (!thisRow) {
    end = { enabled: false, why: "This year is not on the account's schedule." };
  } else {
    const plan = planEndAfterYear(params.rows, thisRow.scheduleYear);
    end = plan.ok
      ? { enabled: true, thisYear: thisRow.academicYear, removedYears: plan.removedYears }
      : { enabled: false, why: plan.reason };
  }

  const addPlan = planAddYear(params.rows, params.naturalHorizon, params.school);
  const firstStart = parseAcademicYearStart(params.firstAssessmentYear);
  const add: ScheduleAddControl = addPlan.ok
    ? {
        enabled: true,
        addedYear:
          firstStart != null
            ? formatAcademicYearLabel(firstStart + addPlan.scheduleYear - 1)
            : `year ${addPlan.scheduleYear}`,
        reopens: params.accountClosed,
      }
    : { enabled: false, why: addPlan.reason };

  return { end, add };
}

/** A planned schedule row, before persistence. */
export interface PlannedScheduleEntry {
  scheduleYear: number;
  academicYear: string;
  availableOn: Date | null;
  requiredBy: Date | null;
  showOnPortal: boolean;
}

/** Shifts a date forward by `n` whole years (null-safe). */
function shiftYears(date: Date | null, n: number): Date | null {
  if (!date) return null;
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d;
}

/**
 * Pure: compute the planned schedule rows for an account. Year 1 is the award
 * year; each later year shifts the academic year + dates forward by one.
 *
 * `awardAcademicYear` is the award round's academicYear (e.g. "2026/2027").
 * `awardOpenDate`/`awardCloseDate` are the award round's dates (the date policy
 * anchor). When the academic year can't be parsed the academicYear labels fall
 * back to the raw award label for Year 1 and an indexed suffix thereafter.
 */
export function planSchedule(params: {
  awardAcademicYear: string;
  awardOpenDate: Date | null;
  awardCloseDate: Date | null;
  horizon: number;
}): PlannedScheduleEntry[] {
  const { awardAcademicYear, awardOpenDate, awardCloseDate, horizon } = params;
  const startYear = parseAcademicYearStart(awardAcademicYear);

  const rows: PlannedScheduleEntry[] = [];
  for (let i = 0; i < horizon; i++) {
    const scheduleYear = i + 1;
    const academicYear =
      startYear != null
        ? formatAcademicYearLabel(startYear + i)
        : i === 0
          ? awardAcademicYear
          : `${awardAcademicYear} +${i}`;
    rows.push({
      scheduleYear,
      academicYear,
      availableOn: shiftYears(awardOpenDate, i),
      requiredBy: shiftYears(awardCloseDate, i),
      // Epic 21 #5 (D-2): every year shown; the admin hides one by unticking.
      showOnPortal: true,
    });
  }
  return rows;
}

/** The account fields generation needs. */
export interface ScheduleAccount {
  id: string;
  /** S9: decides the final eligible school year (OP: Year 11). */
  school: School;
  entryYearGroup: EntryYearGroup | null;
  firstAssessmentYear: string;
  /** Epic 21 #4 — the ADMIN's end of schedule; null/absent = natural horizon. */
  scheduleEndYear?: number | null;
}

/** The award round's date anchors. */
export interface ScheduleRoundDates {
  academicYear: string;
  openDate: Date | null;
  closeDate: Date | null;
}

export interface GenerateScheduleResult {
  horizon: number;
  created: number;
  /** Rows skipped because they already exist (idempotency). */
  skipped: number;
}

/**
 * Generate (or top-up) the forward schedule for an account. IDEMPOTENT:
 *   - never duplicates a (bursaryAccountId, scheduleYear) row,
 *   - never rewrites a RECEIVED/COMPLETE year (history is immutable),
 *   - only INSERTs missing future rows, so re-awarding or "Regenerate Schedule"
 *     is safe.
 *
 * Persists `scheduleYears` (the resolved horizon) onto the account.
 */
export async function generateSchedule(
  tx: Tx,
  account: ScheduleAccount,
  round: ScheduleRoundDates
): Promise<GenerateScheduleResult> {
  // Epic 21 #4: never past an ADMIN's "End after this year".
  const horizon = effectiveHorizon(
    resolveScheduleHorizon(account.entryYearGroup, undefined, account.school),
    account.scheduleEndYear
  );
  const planned = planSchedule({
    awardAcademicYear: round.academicYear,
    awardOpenDate: round.openDate,
    awardCloseDate: round.closeDate,
    horizon,
  });

  // Existing rows by scheduleYear — the idempotency key.
  const existing = await tx.bursaryScheduleEntry.findMany({
    where: { bursaryAccountId: account.id },
    select: { scheduleYear: true },
  });
  const existingYears = new Set(existing.map((e) => e.scheduleYear));

  let created = 0;
  let skipped = 0;
  for (const row of planned) {
    if (existingYears.has(row.scheduleYear)) {
      skipped++;
      continue;
    }
    await tx.bursaryScheduleEntry.create({
      data: {
        bursaryAccountId: account.id,
        scheduleYear: row.scheduleYear,
        academicYear: row.academicYear,
        availableOn: row.availableOn,
        requiredBy: row.requiredBy,
        showOnPortal: row.showOnPortal,
        manuallyCreated: false,
      },
    });
    created++;
  }

  // Record the agreed horizon on the account (idempotent — same value on re-run).
  await tx.bursaryAccount.update({
    where: { id: account.id },
    data: { scheduleYears: horizon },
  });

  return { horizon, created, skipped };
}

/**
 * Epic 21 #4 — the date anchor for an account's schedule: the round of its
 * FIRST assessment year, so a re-inserted year gets the right academic year
 * and dates. (The award-lock path used to anchor on the current application's
 * round, which shifts every planned label by the years since the award.) Dates
 * fall back to null when that round can't be found.
 */
export async function roundDatesForAccount(
  tx: Tx,
  account: Pick<ScheduleAccount, "firstAssessmentYear">
): Promise<ScheduleRoundDates> {
  const round = await tx.round.findUnique({
    where: { academicYear: account.firstAssessmentYear },
    select: { openDate: true, closeDate: true },
  });
  return {
    academicYear: account.firstAssessmentYear,
    openDate: round?.openDate ?? null,
    closeDate: round?.closeDate ?? null,
  };
}
