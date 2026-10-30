/**
 * schedule-dates.ts — Epic 21 R2 (14 Oct 2026): where a schedule year's dates
 * come from. ONE pure module, so the planner, the re-dating on a Rounds-page
 * save, the admin grids and the family's schedule (Epic 22 P5's table) all
 * read the same answer.
 *
 * A schedule year has two kinds of date:
 *
 *  - the WINDOW (stored on the row as `availableOn` / `requiredBy`): when the
 *    year's application opens and closes for everyone. Year 1 carries the
 *    award round's own dates. Every later year is a rolling-over year, so it
 *    carries the rolling-over (RA) window of the round FOR THAT ACADEMIC YEAR
 *    once that round has one (`rollingOverWindowFor`), else the placeholder
 *    from `round-scenario.ts` (15 Apr / 21 May, Charlotte's D-1). The real
 *    date is per round: she sets it each year on the Rounds page (2026/27's
 *    is Sat 22 May 2027, deliberately a day after the 21st).
 *
 *  - the FAMILY'S OWN deadline: a per-application `submissionDeadlineAt`
 *    override (an extension, or an earlier date) beats the window once that
 *    year's application exists (`scheduleRowDates`).
 *
 * Spring rolling-over applications go into the round for the academic year
 * they apply for (spring 2027 → the 2027/28 round), never the current one, so
 * "the round for that academic year" is the one whose `academicYear` starts in
 * the same calendar year as the row's label ("2027-28" ↔ "2027/28").
 */

import { resolveRoundScenario } from "@/lib/rounds/round-scenario";

/** A round's stored RA window, as far as the schedule needs it. */
export interface StoredRollingWindow {
  opensOn: Date | null;
  submitBy: Date | null;
}

export interface RollingOverWindow {
  opensOn: Date;
  submitBy: Date;
  /** Where each came from: the round's stored RA window, or the placeholder. */
  source: "roundWindow" | "placeholder";
}

/**
 * The rolling-over window for the academic year starting in `startYear`
 * (2027 → "2027-28", applied for in spring 2027): the stored RA window of that
 * year's round, date by date, else the round-scenario placeholder.
 */
export function rollingOverWindowFor(
  startYear: number,
  stored: StoredRollingWindow | null | undefined
): RollingOverWindow {
  const placeholder = resolveRoundScenario({
    applicationType: "ROLLING_OVER",
    roundStartYear: startYear,
    // Unused for RA: its window depends only on the round's year.
    onDate: new Date(0),
  });
  const opensOn = stored?.opensOn ?? null;
  const submitBy = stored?.submitBy ?? null;
  return {
    opensOn: opensOn ?? placeholder.opensOn,
    submitBy: submitBy ?? placeholder.submitBy,
    source: opensOn || submitBy ? "roundWindow" : "placeholder",
  };
}

/** Stored RA windows keyed by their round's academic start year. */
export type RollingWindowsByYear = ReadonlyMap<number, StoredRollingWindow>;

export interface ScheduleRowDatesInput {
  /** The row's stored window (follows the round window; see the module doc). */
  availableOn: Date | null;
  requiredBy: Date | null;
  /** That year's application, once it exists; null before. */
  application: { submissionDeadlineAt: Date | null } | null;
}

export interface ScheduleRowDates {
  /** When the year's application opens ("Application opening date"). */
  opensOn: Date | null;
  /** When the window closes for everyone ("Application Closing Date"). */
  closesOn: Date | null;
  /**
   * The family's own deadline ("To be submitted by"): their per-application
   * override when one is set, else the window close.
   */
  submitBy: Date | null;
  /** True when the family's deadline is their own and falls on another day. */
  hasOwnDeadline: boolean;
}

/** The London calendar day of an instant, as YYYY-MM-DD. */
function londonDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * The dates one schedule row shows. Epic 22 P5's family table reads
 * `closesOn` as "Application Closing Date" and `submitBy` as "To be submitted
 * by"; the admin grids show `submitBy` and flag `hasOwnDeadline`.
 *
 * `requiredBy` is a `@db.Date` (UTC midnight) and the override an instant, so
 * "another day" compares the override's London day with the stored date's
 * calendar day.
 */
export function scheduleRowDates(input: ScheduleRowDatesInput): ScheduleRowDates {
  const override = input.application?.submissionDeadlineAt ?? null;
  const closesOn = input.requiredBy;
  const hasOwnDeadline =
    override != null &&
    (closesOn == null || londonDay(override) !== closesOn.toISOString().slice(0, 10));
  return {
    opensOn: input.availableOn,
    closesOn,
    submitBy: override ?? closesOn,
    hasOwnDeadline,
  };
}
