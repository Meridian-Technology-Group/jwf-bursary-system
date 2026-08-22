/**
 * payable-fees-schedule.ts — Epic 14 C8 (CG-24): the ASSESSMENT ADMIN tab's
 * payable-fees schedule table.
 *
 * One row per `BursaryScheduleEntry` year (Epic 10), joined to that year's
 * application → assessment → recommendation where they exist: academic year ·
 * reason codes (the year's YoY selections) · payable fees · Δ vs prior year ·
 * school year · submit-by · application status · assessment status · bursary
 * status. Future rows render "Scheduled / Not started" exactly as in
 * Charlotte's example. Read-only projection — no new write path.
 */

import type { Tx } from "@/lib/db/prisma";
import { schoolYearForEntryYearGroup } from "@/lib/assessment/schooling-years";

export interface PayableFeesScheduleTableRow {
  scheduleYear: number;
  academicYear: string;
  /** "Year 7" etc.; null when the entry year-group gives no deterministic base. */
  schoolYearLabel: string | null;
  /** The year's YoY reason-code labels (from its recommendation), workbook order. */
  reasonCodes: string[];
  payableFees: number | null;
  deltaPayableFees: number | null;
  submitBy: Date | null;
  applicationStatus: string;
  assessmentStatus: string;
  bursaryStatus: string;
}

function toNum(value: unknown): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

// Single source of truth for group → school-year (CH-26 added Y8/Y10/Y11/Y13);
// OTHER / null / unrecognised → null and the row's school-year label is omitted.
const schoolYearBase = schoolYearForEntryYearGroup;

/** "2026-27" and "2026/27" are the same academic year — one comparable key. */
function normaliseAcademicYear(value: string): string {
  return value.replace(/[/-]/g, "-").trim();
}

export async function getPayableFeesScheduleRows(
  tx: Tx,
  bursaryAccountId: string
): Promise<PayableFeesScheduleTableRow[]> {
  const account = await tx.bursaryAccount.findUnique({
    where: { id: bursaryAccountId },
    select: {
      status: true,
      entryYearGroup: true,
      scheduleEntries: {
        orderBy: { scheduleYear: "asc" },
        select: {
          scheduleYear: true,
          academicYear: true,
          status: true,
          requiredBy: true,
          applicationId: true,
        },
      },
    },
  });
  if (!account) return [];

  // The account's applications, keyed by id AND by normalised academic year —
  // schedule generation does not always back-link `applicationId` (Epic 10
  // links lazily), so a year's application is also matched by its round.
  const applications = await tx.application.findMany({
    where: { bursaryAccountId },
    select: {
      id: true,
      formStatus: true,
      closedAt: true,
      applicationType: true,
      round: { select: { academicYear: true } },
      assessment: {
        select: {
          status: true,
          outcome: true,
          recommendation: {
            select: {
              confirmedPayableFees: true,
              yearlyPayableFees: true,
              reasonCodes: {
                select: { reasonCode: { select: { label: true, sortOrder: true } } },
              },
            },
          },
        },
      },
    },
  });
  const appById = new Map(applications.map((a) => [a.id, a]));
  const appByYear = new Map(
    applications.map((a) => [normaliseAcademicYear(a.round.academicYear), a])
  );

  const base = schoolYearBase(account.entryYearGroup);
  const bursaryStatus = account.status === "ACTIVE" ? "Active" : "Closed";

  const rows: PayableFeesScheduleTableRow[] = account.scheduleEntries.map(
    (entry, idx) => {
      const app =
        (entry.applicationId ? appById.get(entry.applicationId) : null) ??
        appByYear.get(normaliseAcademicYear(entry.academicYear)) ??
        null;
      const assessment = app?.assessment ?? null;
      const rec = assessment?.recommendation ?? null;

      const applicationStatus = !app
        ? "Scheduled"
        : app.closedAt
          ? "Closed"
          : app.formStatus === "SUBMITTED"
            ? "Received"
            : "In progress";

      const assessmentStatus = !assessment
        ? "Not started"
        : assessment.status === "COMPLETED"
          ? "Completed"
          : assessment.status === "PAUSED"
            ? "Paused"
            : assessment.status === "IN_PROGRESS"
              ? "In progress"
              : "Not started";

      const payableFees =
        toNum(rec?.confirmedPayableFees) ?? toNum(rec?.yearlyPayableFees);

      const reasonCodes = (rec?.reasonCodes ?? [])
        .map((r) => r.reasonCode)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => r.label);

      return {
        scheduleYear: entry.scheduleYear,
        academicYear: entry.academicYear,
        schoolYearLabel: base != null ? `Year ${base + idx}` : null,
        reasonCodes,
        payableFees,
        deltaPayableFees: null, // filled in the pass below
        submitBy: entry.requiredBy,
        applicationStatus,
        assessmentStatus,
        bursaryStatus,
      };
    }
  );

  // Δ payable fees vs the PREVIOUS year that has a figure (workbook: n/a for
  // the first assessed year).
  let previous: number | null = null;
  for (const row of rows) {
    if (row.payableFees != null) {
      row.deltaPayableFees = previous != null ? row.payableFees - previous : null;
      previous = row.payableFees;
    }
  }

  return rows;
}
