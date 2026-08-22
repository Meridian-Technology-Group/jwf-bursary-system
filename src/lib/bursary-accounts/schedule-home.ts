/**
 * schedule-home.ts — Epic 14 D3 (CG-02/03, US-D3/D4): the returning parent's
 * Bursary Application Schedule.
 *
 * Charlotte's ask: a returning family (≥1 bursary account) lands on a per-
 * child schedule — one row per academic year with the year's dates and ONE
 * state cell:
 *   - SUBMITTED          — that year's application is in (label only)
 *   - START APPLICATION  — the open year, startable now (button)
 *   - CONTINUE           — the open year with an in-flight draft (button)
 *   - LOCKED             — future years (inert)
 *   - CLOSED             — a past year that never got a submission (inert;
 *                          not in her three-state list but the honest label —
 *                          calling a missed year LOCKED would imply it is
 *                          still to come).
 *
 * Date columns per row, first source wins:
 *   opening    — entry.availableOn → RoundWindow.opensOn (D1 scenario) →
 *                Round.openDate → resolver derived default
 *   submit by  — entry.requiredBy → the Epic 13 E1 chain (application
 *                override → typed round default, window-filled per D2 →
 *                closeDate) → resolver derived default
 *   award news — Round.decisionDate (nothing else knows it) → null ("—")
 *
 * Scenario typing: schedule year 1 is the original NEW application; every
 * later year is a ROLLING_OVER re-assessment (RA window, 12 Apr – 22 May
 * defaults).
 *
 * Pure module — the caller loads accounts/entries/rounds/applications and
 * hands row-shaped inputs in; nothing here touches the DB or the clock.
 */

import type { EntryYearGroup, ScheduleEntryStatus } from "@prisma/client";
import {
  parseAcademicYearStart,
  formatAcademicYearLabel,
} from "@/lib/assessment/fee-year";
import {
  effectiveSubmissionDeadline,
  type SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";
import { resolveRoundScenario } from "@/lib/rounds/round-scenario";
import {
  applyWindowToDeadlineRound,
  windowForScenario,
  type StoredRoundWindow,
} from "@/lib/rounds/window-consumption";
import { schoolYearForEntryYearGroup } from "@/lib/assessment/schooling-years";

export type ScheduleHomeRowState =
  | "submitted"
  | "continue"
  | "start"
  | "locked"
  | "closed";

export interface ScheduleHomeApplicationInput {
  id: string;
  formStatus: "CREATED" | "NOT_STARTED" | "IN_PROGRESS" | "FILLED_IN" | "SUBMITTED";
  applicationType: "NEW" | "ROLLING_OVER";
  submissionDeadlineAt: Date | null;
}

export interface ScheduleHomeRoundInput extends SubmissionDeadlineRound {
  openDate: Date;
  decisionDate: Date | null;
  windows: readonly StoredRoundWindow[];
}

export interface ScheduleHomeEntryInput {
  scheduleYear: number;
  academicYear: string;
  availableOn: Date | null;
  requiredBy: Date | null;
  status: ScheduleEntryStatus;
  round: ScheduleHomeRoundInput | null;
  application: ScheduleHomeApplicationInput | null;
}

export interface ScheduleHomeRow {
  scheduleYear: number;
  /** Label formatted like the admin grid, e.g. "2027-28". */
  academicYear: string;
  /** School year number (6..13), or null when the entry group is OTHER. */
  schoolYear: number | null;
  openingDate: Date | null;
  submissionDeadline: Date | null;
  awardCommunicationDate: Date | null;
  state: ScheduleHomeRowState;
  /** Verbatim button/cell text. */
  stateLabel: string;
  /** The application the CONTINUE state resumes; null otherwise. */
  applicationId: string | null;
}

const STATE_LABELS: Record<ScheduleHomeRowState, string> = {
  submitted: "SUBMITTED",
  continue: "CONTINUE",
  start: "START APPLICATION",
  locked: "LOCKED",
  closed: "CLOSED",
};

// Single source of truth for group → school-year (CH-26 added Y8/Y10/Y11/Y13);
// OTHER / null / unrecognised → null and the caller falls back.
const schoolYearForGroup = schoolYearForEntryYearGroup;

/** End of a date-only deadline's day, so "due 22 May" includes 22 May. */
function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

export interface BuildScheduleHomeParams {
  entryYearGroup: EntryYearGroup | null;
  entries: readonly ScheduleHomeEntryInput[];
  /** "Now" for the state machine — passed in, never read from the clock. */
  today: Date;
}

export function buildScheduleHomeRows(
  params: BuildScheduleHomeParams
): ScheduleHomeRow[] {
  const { entryYearGroup, entries, today } = params;
  const entrySchoolYear = schoolYearForGroup(entryYearGroup);

  return [...entries]
    .sort((a, b) => a.scheduleYear - b.scheduleYear)
    .map((entry) => {
      const startYear = parseAcademicYearStart(entry.academicYear);
      const applicationType =
        entry.application?.applicationType ??
        (entry.scheduleYear === 1 ? "NEW" : "ROLLING_OVER");

      // D1 scenario for this row's year (RA for rolling years).
      const derived =
        startYear != null
          ? resolveRoundScenario({
              applicationType,
              onDate: today,
              roundStartYear: startYear,
            })
          : null;
      const window = derived
        ? windowForScenario(entry.round?.windows ?? [], derived.scenario)
        : null;

      const openingDate =
        entry.availableOn ??
        window?.opensOn ??
        entry.round?.openDate ??
        derived?.opensOn ??
        null;

      let submissionDeadline: Date | null = entry.requiredBy;
      if (!submissionDeadline && entry.round) {
        const filled = applyWindowToDeadlineRound(
          entry.round,
          window,
          applicationType === "ROLLING_OVER" ? "ROLLING_OVER" : "NEW"
        );
        submissionDeadline = effectiveSubmissionDeadline(
          {
            submissionDeadlineAt: entry.application?.submissionDeadlineAt ?? null,
            applicationType,
          },
          filled
        ).deadline;
      }
      if (!submissionDeadline) submissionDeadline = derived?.submitBy ?? null;

      // ── State machine ────────────────────────────────────────────────────
      let state: ScheduleHomeRowState;
      if (
        entry.application?.formStatus === "SUBMITTED" ||
        entry.status !== "SCHEDULED"
      ) {
        // The year's assessment is in (or already processed by the office).
        state = "submitted";
      } else if (entry.application) {
        // An in-flight draft — resumable regardless of window edges (the
        // portal's own deadline lockout governs editability).
        state = "continue";
      } else {
        const opensAt = openingDate?.getTime() ?? null;
        const dueBy = submissionDeadline
          ? endOfDay(submissionDeadline).getTime()
          : null;
        const now = today.getTime();
        if (opensAt != null && now < opensAt) {
          state = "locked";
        } else if (dueBy != null && now > dueBy) {
          state = "closed";
        } else if (entry.round) {
          // Inside the window with a real round to apply into.
          state = "start";
        } else {
          // In-window on derived dates alone but no round exists yet — there
          // is nothing to start; keep it locked rather than dead-end a click.
          state = "locked";
        }
      }

      return {
        scheduleYear: entry.scheduleYear,
        academicYear:
          startYear != null
            ? formatAcademicYearLabel(startYear)
            : entry.academicYear,
        schoolYear:
          entrySchoolYear != null
            ? entrySchoolYear + (entry.scheduleYear - 1)
            : null,
        openingDate,
        submissionDeadline,
        awardCommunicationDate: entry.round?.decisionDate ?? null,
        state,
        stateLabel: STATE_LABELS[state],
        applicationId:
          state === "continue" ? (entry.application?.id ?? null) : null,
      };
    });
}
