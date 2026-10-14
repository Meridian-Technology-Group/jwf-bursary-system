/**
 * Epic 22 P5 — loads My Application(s) Schedule: every ACTIVE account with a
 * portal-visible row, each with its applications (migrated placeholders
 * included, so a Grant Tracker year reads as such), its rejection records (P3)
 * and each draft's completion (P1's figure).
 *
 * Everything runs under the parent's own RLS context: their accounts,
 * schedule rows, applications and rejection records only. Dates come from the
 * stored schedule rows (Epic 21 R2), so no staff-only round windows are read.
 */

import "server-only";

import type { CurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getPortalScheduleAccountsForUser } from "@/lib/db/queries/schedule";
import { getRejectionsForAccounts } from "@/lib/applications/rejection-record";
import { draftCompletion } from "@/lib/portal/draft-completion";
import { childYearLine } from "@/lib/portal/current-school-year";
import { schoolName } from "@/lib/schools";
import {
  scheduleRowsForParent,
  type ParentScheduleRow,
} from "@/lib/portal/parent-schedule";

export interface ParentScheduleSection {
  accountId: string;
  childName: string;
  /** "Trinity School" — the School column. */
  school: string;
  /** "Currently in Year 8 at Trinity School" (P4's helper). */
  yearLine: string;
  rows: ParentScheduleRow[];
}

export async function loadParentSchedule(
  user: CurrentUser,
  today: Date
): Promise<ParentScheduleSection[]> {
  return withUserContext(user.id, user.role as RlsRole, async (tx) => {
    const accounts = await getPortalScheduleAccountsForUser(tx, user.id);
    if (accounts.length === 0) return [];

    const [applications, rejections] = await Promise.all([
      tx.application.findMany({
        where: { leadApplicantId: user.id },
        select: {
          id: true,
          childName: true,
          bursaryAccountId: true,
          formStatus: true,
          submittedAt: true,
          submissionDeadlineAt: true,
          migrationSource: true,
          isReassessment: true,
          updatedAt: true,
          round: { select: { academicYear: true } },
        },
      }),
      getRejectionsForAccounts(
        tx,
        accounts.map((a) => a.id)
      ),
    ]);

    // P1's figure for each draft (a family has one to four children).
    const completions = new Map<string, number>();
    for (const app of applications) {
      if (app.formStatus === "SUBMITTED" || app.migrationSource) continue;
      completions.set(app.id, (await draftCompletion(tx, app, user.id)).percent);
    }

    const apps = applications.map((a) => ({
      id: a.id,
      childName: a.childName,
      bursaryAccountId: a.bursaryAccountId,
      academicYear: a.round?.academicYear ?? null,
      formStatus: a.formStatus,
      submittedAt: a.submittedAt,
      submissionDeadlineAt: a.submissionDeadlineAt,
      migrationSource: a.migrationSource,
      updatedAt: a.updatedAt,
    }));

    return accounts.map((account) => ({
      accountId: account.id,
      childName: account.childName,
      school: schoolName(account.school),
      yearLine: childYearLine({
        entryYearGroup: account.entryYearGroup,
        firstAssessmentYear: account.firstAssessmentYear,
        school: account.school,
        today,
      }),
      rows: scheduleRowsForParent(
        {
          id: account.id,
          childName: account.childName,
          school: account.school,
          entryYearGroup: account.entryYearGroup,
          entries: account.scheduleEntries,
          applications: apps,
          rejections: rejections.filter((r) => r.bursaryAccountId === account.id),
          completions,
        },
        today
      ),
    }));
  });
}
