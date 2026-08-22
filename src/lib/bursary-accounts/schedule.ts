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
 * Show/Hide on portal (illustration default): the current/next schedule year is
 * shown; far-future years are hidden until they approach.
 */

import type { Tx } from "@/lib/db/prisma";
import type { EntryYearGroup } from "@prisma/client";
import {
  parseAcademicYearStart,
  formatAcademicYearLabel,
} from "@/lib/assessment/fee-year";
// Single source of truth for group → school-year (CH-26 added Y8/Y10/Y11/Y13);
// OTHER / null / unrecognised → null and the caller falls back to the default.
import { schoolYearForEntryYearGroup as schoolYearForGroup } from "@/lib/assessment/schooling-years";

/** The final school year a bursary can run to (Year 13 / Upper Sixth). */
export const FINAL_ELIGIBLE_SCHOOL_YEAR = 13;

/** Hard ceiling on generated years, so a bad entry-year never explodes the grid. */
export const MAX_SCHEDULE_YEARS = 8;

/** How many future years (incl. the award year) are shown on the portal by default. */
const DEFAULT_PORTAL_VISIBLE_YEARS = 2;

/**
 * D19 horizon: number of assessment years to generate, counting the award year
 * as Year 1. Defaults to "years to the final eligible school year" derived from
 * the entry year-group, clamped to [1, MAX_SCHEDULE_YEARS]. When the group is
 * OTHER/unknown, falls back to `fallback` (default MAX_SCHEDULE_YEARS so the
 * grid is generous and the admin trims via Regenerate rather than under-running).
 */
export function resolveScheduleHorizon(
  entryYearGroup: EntryYearGroup | null,
  fallback: number = MAX_SCHEDULE_YEARS
): number {
  const startYear = schoolYearForGroup(entryYearGroup);
  if (startYear == null) {
    return Math.min(Math.max(fallback, 1), MAX_SCHEDULE_YEARS);
  }
  // Inclusive of both the entry year and the final year.
  const years = FINAL_ELIGIBLE_SCHOOL_YEAR - startYear + 1;
  return Math.min(Math.max(years, 1), MAX_SCHEDULE_YEARS);
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
      // Current + next year shown; far-future hidden until they approach.
      showOnPortal: scheduleYear <= DEFAULT_PORTAL_VISIBLE_YEARS,
    });
  }
  return rows;
}

/** The account fields generation needs. */
export interface ScheduleAccount {
  id: string;
  entryYearGroup: EntryYearGroup | null;
  firstAssessmentYear: string;
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
  const horizon = resolveScheduleHorizon(account.entryYearGroup);
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
