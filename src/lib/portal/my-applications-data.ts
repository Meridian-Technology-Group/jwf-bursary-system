/**
 * Epic 22 P1 — loads what My Bursary Application(s) needs, then hands it to the
 * pure `buildApplicationBlocks`.
 *
 * Contexts (same split as the home page):
 *   - accounts + schedule rows: ADMIN context, hard-scoped to the parent
 *     (`getScheduleHomeForUser` needs `round_windows`, staff-read under RLS);
 *   - applications + each draft's gap analysis: the PARENT's own RLS context;
 *   - invitations + the profile's sign-in times: ADMIN context, hard-scoped to
 *     the parent's id (invitations are not applicant-readable under RLS).
 * Only parent-safe facts leave here: names, schools, dates, percentages.
 */

import "server-only";

import { InvitationStatus } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth/roles";
import { withAdminContext, withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getScheduleHomeForUser } from "@/lib/db/queries/schedule";
import { syncSignInTimes } from "@/lib/auth/sign-in-times";
import { buildScheduleHomeRows } from "@/lib/bursary-accounts/schedule-home";
import { PORTAL_APPLICATION } from "@/lib/applications/migration-source";
import { canCreateFirstYearApplication } from "@/lib/applications/create-from-invitation";
import { parseAcademicYearStart } from "@/lib/assessment/fee-year";
import { draftCompletion } from "@/lib/portal/draft-completion";
import {
  buildApplicationBlocks,
  type ApplicationBlock,
  type DraftCompletion,
} from "@/lib/portal/my-applications";

export interface MyApplicationsData {
  blocks: ApplicationBlock[];
  previousSignInAt: Date | null;
}

export async function loadMyApplications(
  user: CurrentUser,
  today: Date
): Promise<MyApplicationsData> {
  // The layout runs the same sync, but Next renders layout and page
  // concurrently, so on the first page after a sign-in this page could read
  // the times before the layout shifted them. The write is guarded on the
  // value read, so the two calls shift the times once.
  await syncSignInTimes(user.id, user.authLastSignInAt);

  const [accountData, adminFacts] = await Promise.all([
    withAdminContext((tx) => getScheduleHomeForUser(tx, user.id)),
    withAdminContext(async (tx) => {
      const [invitations, profile] = await Promise.all([
        tx.invitation.findMany({
          where: {
            authUserId: user.id,
            // Secondary-parent invitations are accepted via /register.
            applicationId: null,
            roundId: { not: null },
            round: { status: { not: "CLOSED" } },
            OR: [
              { status: InvitationStatus.ACCEPTED },
              // A pending first-year invite is auto-accepted on sight (home);
              // a pending re-assessment invite must still be in date.
              {
                status: InvitationStatus.PENDING,
                OR: [{ bursaryAccountId: null }, { expiresAt: { gt: today } }],
              },
            ],
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            childName: true,
            school: true,
            bursaryAccountId: true,
            roundId: true,
            entryYear: true,
            entryYearGroup: true,
          },
        }),
        tx.profile.findUnique({
          where: { id: user.id },
          select: { previousSignInAt: true },
        }),
      ]);
      return { invitations, previousSignInAt: profile?.previousSignInAt ?? null };
    }),
  ]);

  const { applications, completions } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const apps = await tx.application.findMany({
        where: { leadApplicantId: user.id, archivedAt: null, ...PORTAL_APPLICATION },
        select: {
          id: true,
          childName: true,
          school: true,
          bursaryAccountId: true,
          roundId: true,
          formStatus: true,
          submittedAt: true,
          submissionDeadlineAt: true,
          updatedAt: true,
          isReassessment: true,
          round: { select: { academicYear: true } },
        },
      });

      // One gap analysis per draft: a family has one to four children.
      const completions = new Map<string, DraftCompletion>();
      for (const app of apps) {
        if (app.formStatus === "SUBMITTED") continue;
        completions.set(app.id, await draftCompletion(tx, app, user.id));
      }
      return { applications: apps, completions };
    }
  );

  const blocks = buildApplicationBlocks({
    accounts: accountData.map((account) => ({
      id: account.accountId,
      childName: account.childName,
      school: account.school,
      entries: account.entries,
      rows: buildScheduleHomeRows({
        entryYearGroup: account.entryYearGroup,
        entries: account.entries,
        today,
      }),
    })),
    applications: applications.map((app) => ({
      id: app.id,
      childName: app.childName,
      school: app.school,
      bursaryAccountId: app.bursaryAccountId,
      roundId: app.roundId,
      roundStartYear: parseAcademicYearStart(app.round?.academicYear),
      formStatus: app.formStatus,
      submittedAt: app.submittedAt,
      updatedAt: app.updatedAt,
    })),
    invitations: adminFacts.invitations.map((inv) => ({
      id: inv.id,
      childName: inv.childName,
      school: inv.school,
      bursaryAccountId: inv.bursaryAccountId,
      roundId: inv.roundId,
      needsDetails:
        !inv.bursaryAccountId &&
        !canCreateFirstYearApplication({
          leadApplicantId: user.id,
          roundId: inv.roundId,
          school: inv.school,
          childName: inv.childName,
          entryYear: inv.entryYear,
          entryYearGroup: inv.entryYearGroup,
        }),
    })),
    completions,
    today,
  });

  return { blocks, previousSignInAt: adminFacts.previousSignInAt };
}
