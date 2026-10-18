/**
 * Epic 22 P5 (CR-002 Phase 5 #3) — My Application(s) Schedule: one table per
 * child, the nine columns of her sheet.
 *
 * Pure: the page loads each ACTIVE account's portal-visible schedule rows, its
 * applications, its rejection records (P3) and each draft's completion (P1),
 * and this builds the rows. Nothing here reads the DB or the clock.
 *
 * Columns:
 *   Academic Year · School Year · School · Application Opening Date ·
 *   Application Closing Date · To be submitted by · Completion Status ·
 *   Submission Status · Submission Date
 *
 * Dates come from Epic 21 R2's `scheduleRowDates` (D-13): opening =
 * `opensOn`, closing = `closesOn` (the window, for everyone), to be submitted
 * by = `submitBy` (the family's own deadline when one was set). A Grant
 * Tracker year shows the dates it ran on in GT instead (`migratedYearDates`).
 *
 * No outcome is ever shown (awards stay off the portal): a submitted year
 * stays "Submitted" after it is assessed, and a pause keeps the original
 * submission date (D-2).
 */

import type { ScheduleEntryStatus, School } from "@prisma/client";
import { parseAcademicYearStart, formatAcademicYearLabel } from "@/lib/assessment/fee-year";
import { schoolYearForEntryYearGroup } from "@/lib/assessment/schooling-years";
import { scheduleRowDates } from "@/lib/bursary-accounts/schedule-dates";
import { formatCompletion } from "@/lib/portal/application-completion";

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface ParentScheduleEntryInput {
  scheduleYear: number;
  academicYear: string;
  status: ScheduleEntryStatus;
  availableOn: Date | null;
  requiredBy: Date | null;
  receivedOn: Date | null;
  applicationId: string | null;
}

export interface ParentScheduleApplicationInput {
  id: string;
  childName: string;
  bursaryAccountId: string | null;
  /** The application's round, e.g. "2027/28". */
  academicYear: string | null;
  formStatus: string;
  submittedAt: Date | null;
  submissionDeadlineAt: Date | null;
  /** Non-null for a Grant Tracker placeholder (no form in this system). */
  migrationSource: string | null;
  /** NEW or ROLLING_OVER — picks a Grant Tracker year's dates. */
  applicationType: string;
  updatedAt: Date;
}

export interface ParentScheduleRejectionInput {
  academicYear: string;
  submittedAt: Date | null;
  rejectedAt: Date;
}

export interface ParentScheduleAccountInput {
  id: string;
  childName: string;
  school: School;
  entryYearGroup: string | null;
  entries: readonly ParentScheduleEntryInput[];
  /** Every application the parent can see; matched to rows here. */
  applications: readonly ParentScheduleApplicationInput[];
  rejections: readonly ParentScheduleRejectionInput[];
  /** P1's completion figure for each draft, by application id. */
  completions: ReadonlyMap<string, number>;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export type ParentScheduleStatus =
  | "Scheduled"
  | "Open, not started"
  | "In progress"
  | "Submitted"
  | "Rejected"
  /** 17 Oct 2026: past its Submit by with nothing submitted, in red (was "Not submitted"). */
  | "Overdue";

export interface ParentScheduleRow {
  key: string;
  academicYear: string;
  schoolYear: number | null;
  opensOn: Date | null;
  closesOn: Date | null;
  submitBy: Date | null;
  /** The family's own deadline differs from the closing date (an extension). */
  hasOwnDeadline: boolean;
  /** "62.5%", "100% completed", "—" or blank. */
  completion: string;
  status: ParentScheduleStatus;
  submissionDate: Date | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPLETED = "100% completed";
const NONE = "—";

function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** UTC midnight of an instant's London calendar day (a `@db.Date` value). */
function londonDate(d: Date): Date {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return new Date(`${day}T00:00:00.000Z`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rolling-over windows Grant Tracker ran, by academic-year start (her 15 Oct
 * answer). Only 2026-27 was migrated.
 */
const GT_ROLLING_WINDOWS: Record<number, { opensOn: string; closesOn: string; submitBy: string }> = {
  2026: { opensOn: "2026-04-15", closesOn: "2026-05-21", submitBy: "2026-05-23" },
};

/**
 * The dates a Grant Tracker year shows (her 15 Oct answer), or null to keep
 * the schedule row's own dates:
 *   - rolling-over: that year's GT renewal window;
 *   - new: opened 7 days before the GT submission date, closed and due on it.
 */
export function migratedYearDates(
  application: Pick<ParentScheduleApplicationInput, "applicationType" | "submittedAt">,
  academicYearStart: number | null
): { opensOn: Date; closesOn: Date; submitBy: Date } | null {
  if (application.applicationType === "ROLLING_OVER") {
    const w = academicYearStart != null ? GT_ROLLING_WINDOWS[academicYearStart] : undefined;
    if (!w) return null;
    return {
      opensOn: new Date(`${w.opensOn}T00:00:00.000Z`),
      closesOn: new Date(`${w.closesOn}T00:00:00.000Z`),
      submitBy: new Date(`${w.submitBy}T00:00:00.000Z`),
    };
  }
  if (!application.submittedAt) return null;
  const submitted = londonDate(application.submittedAt);
  return {
    opensOn: new Date(submitted.getTime() - 7 * DAY_MS),
    closesOn: submitted,
    submitBy: submitted,
  };
}

function endOfDay(d: Date): number {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out.getTime();
}

/**
 * The application a schedule year describes: the row's own back-link first,
 * else this account's application for that academic year, else (for the
 * original NEW form, which isn't linked to the account) one with the child's
 * name. Same rule as the home schedule (`getScheduleHomeForUser`).
 */
export function applicationForEntry(
  entry: ParentScheduleEntryInput,
  account: Pick<ParentScheduleAccountInput, "id" | "childName">,
  applications: readonly ParentScheduleApplicationInput[]
): ParentScheduleApplicationInput | null {
  if (entry.applicationId) {
    const own = applications.find((a) => a.id === entry.applicationId);
    if (own) return own;
  }
  const start = parseAcademicYearStart(entry.academicYear);
  if (start == null) return null;
  const candidates = applications.filter(
    (a) =>
      parseAcademicYearStart(a.academicYear) === start &&
      (a.bursaryAccountId === account.id ||
        (a.bursaryAccountId == null && nameKey(a.childName) === nameKey(account.childName)))
  );
  // A real form beats a migrated placeholder; then the most recently touched.
  candidates.sort(
    (a, b) =>
      Number(a.migrationSource != null) - Number(b.migrationSource != null) ||
      b.updatedAt.getTime() - a.updatedAt.getTime()
  );
  return candidates[0] ?? null;
}

/**
 * Submission Status and Completion Status for the year's CURRENT row (D-12).
 * Rejected attempts are separate rows (see `scheduleRowsForParent`).
 */
export function parentScheduleStatus(params: {
  entry: Pick<ParentScheduleEntryInput, "status" | "receivedOn">;
  application: ParentScheduleApplicationInput | null;
  completion: number | null;
  opensOn: Date | null;
  submitBy: Date | null;
  today: Date;
}): { status: ParentScheduleStatus; completion: string; submissionDate: Date | null } {
  const { entry, completion, opensOn, submitBy, today } = params;
  const app = params.application?.migrationSource ? null : params.application;
  const migrated = params.application?.migrationSource != null;

  // A form submitted in this system: "Submitted" with its original date, also
  // once assessed (no outcome on the portal) and through a pause (D-2).
  if (app && app.formStatus === "SUBMITTED") {
    return { status: "Submitted", completion: COMPLETED, submissionDate: app.submittedAt };
  }

  const overdue = submitBy != null && today.getTime() > endOfDay(submitBy);

  // A draft in progress (including a form restarted after a rejection).
  if (app) {
    const pct = completion ?? 0;
    const started = pct > 0 || app.formStatus === "IN_PROGRESS" || app.formStatus === "FILLED_IN";
    return {
      status: overdue ? "Overdue" : started ? "In progress" : "Open, not started",
      completion: formatCompletion(pct),
      submissionDate: null,
    };
  }

  // A Grant Tracker year: "Submitted" on its GT submission date (her 15 Oct
  // answer — the family never saw Grant Tracker by name).
  if (migrated) {
    return {
      status: "Submitted",
      completion: COMPLETED,
      submissionDate: params.application?.submittedAt ?? null,
    };
  }

  // No form in this system for the year.
  if (entry.status === "COMPLETE") {
    return { status: "Submitted", completion: COMPLETED, submissionDate: entry.receivedOn };
  }
  if (entry.status === "RECEIVED") {
    return { status: "Submitted", completion: COMPLETED, submissionDate: entry.receivedOn };
  }

  const now = today.getTime();
  if (opensOn && now < opensOn.getTime()) {
    return { status: "Scheduled", completion: NONE, submissionDate: null };
  }
  if (overdue) {
    return { status: "Overdue", completion: NONE, submissionDate: null };
  }
  return { status: "Open, not started", completion: formatCompletion(0), submissionDate: null };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function scheduleRowsForParent(
  account: ParentScheduleAccountInput,
  today: Date
): ParentScheduleRow[] {
  const entrySchoolYear = schoolYearForEntryYearGroup(account.entryYearGroup);
  const rows: ParentScheduleRow[] = [];

  for (const entry of [...account.entries].sort((a, b) => a.scheduleYear - b.scheduleYear)) {
    const start = parseAcademicYearStart(entry.academicYear);
    const academicYear = start != null ? formatAcademicYearLabel(start) : entry.academicYear;
    const application = applicationForEntry(entry, account, account.applications);
    const gtDates =
      application?.migrationSource != null ? migratedYearDates(application, start) : null;
    const dates = gtDates
      ? { ...gtDates, hasOwnDeadline: false }
      : scheduleRowDates({
      availableOn: entry.availableOn,
      requiredBy: entry.requiredBy,
      application:
        application && !application.migrationSource
          ? { submissionDeadlineAt: application.submissionDeadlineAt }
          : null,
    });
    const shared = {
      academicYear,
      schoolYear: entrySchoolYear != null ? entrySchoolYear + entry.scheduleYear - 1 : null,
      opensOn: dates.opensOn,
      closesOn: dates.closesOn,
      submitBy: dates.submitBy,
      hasOwnDeadline: dates.hasOwnDeadline,
    };

    // D-1: each Reject and restart of this year — the original submission,
    // then the rejection — before the year's current attempt. The newest
    // submission is the valid one. D-19: both rows read "100% completed".
    const rejections = account.rejections
      .filter((r) => start != null && parseAcademicYearStart(r.academicYear) === start)
      .sort((a, b) => a.rejectedAt.getTime() - b.rejectedAt.getTime());
    rejections.forEach((r, i) => {
      rows.push({
        ...shared,
        key: `${entry.scheduleYear}-rejection-${i}-submitted`,
        completion: COMPLETED,
        status: "Submitted",
        submissionDate: r.submittedAt,
      });
      rows.push({
        ...shared,
        key: `${entry.scheduleYear}-rejection-${i}-rejected`,
        completion: COMPLETED,
        status: "Rejected",
        submissionDate: r.rejectedAt,
      });
    });

    const current = parentScheduleStatus({
      entry,
      application,
      completion: application ? (account.completions.get(application.id) ?? null) : null,
      opensOn: dates.opensOn,
      submitBy: dates.submitBy,
      today,
    });
    rows.push({ ...shared, key: `${entry.scheduleYear}`, ...current });
  }

  return rows;
}
