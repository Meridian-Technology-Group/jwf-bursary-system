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
 * by = `submitBy` (the family's own deadline when one was set).
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
  | "Not submitted"
  | "Completed through Grant Tracker";

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

  // A draft in progress (including a form restarted after a rejection).
  if (app) {
    const pct = completion ?? 0;
    const started = pct > 0 || app.formStatus === "IN_PROGRESS" || app.formStatus === "FILLED_IN";
    return {
      status: started ? "In progress" : "Open, not started",
      completion: formatCompletion(pct),
      submissionDate: null,
    };
  }

  // No form in this system for the year.
  if (entry.status === "COMPLETE" || (migrated && entry.status !== "SCHEDULED")) {
    // Migrated pre-portal years: no completion or submission details (her
    // answer, 13 Oct).
    return { status: "Completed through Grant Tracker", completion: "", submissionDate: null };
  }
  if (entry.status === "RECEIVED") {
    return { status: "Submitted", completion: COMPLETED, submissionDate: entry.receivedOn };
  }

  const now = today.getTime();
  if (opensOn && now < opensOn.getTime()) {
    return { status: "Scheduled", completion: NONE, submissionDate: null };
  }
  if (submitBy && now > endOfDay(submitBy)) {
    return { status: "Not submitted", completion: NONE, submissionDate: null };
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
    const dates = scheduleRowDates({
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
