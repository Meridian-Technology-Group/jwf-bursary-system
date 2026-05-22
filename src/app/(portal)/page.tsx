/**
 * Applicant portal dashboard.
 *
 * Shown after login. Displays a welcome message, application status card,
 * and quick action buttons. Content is dynamic based on whether the user
 * has an application and how many sections are complete.
 *
 * When the user has no Application but does have an accepted Invitation, they
 * see an onboarding card to confirm school + child name before entering the
 * form. When there is no invitation at all, a neutral fallback message is
 * shown directing them to contact the Foundation.
 */

import { getCurrentUser } from "@/lib/auth/roles";
import { withAdminContext, withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getCurrentApplicationForUser, getSectionStatusList } from "@/lib/db/queries/applications";
import { getOrAcceptLatestInvitationForUser } from "@/lib/db/queries/invitations";
import { StatusBadge, type ApplicationStatus } from "@/components/shared/status-badge";
import { OnboardingCard } from "@/app/(portal)/onboarding-card";
import { ReassessmentCard } from "@/app/(portal)/reassessment-card";
import { FileText, ArrowRight, ClipboardList } from "lucide-react";

/** Map Prisma ApplicationStatus to StatusBadge's display type. */
function toBadgeStatus(status: string): ApplicationStatus {
  if (status === "PRE_SUBMISSION") return "DRAFT";
  return status as ApplicationStatus;
}

export const metadata = {
  title: "My Application",
};

const TOTAL_SECTIONS = 10;

export default async function PortalDashboardPage() {
  const user = await getCurrentUser();
  const firstName = user?.firstName ?? "there";

  const { application, completedSections, invitation, inviteRoundYear } = user
    ? await (async () => {
        const userScope = await withUserContext(
          user.id,
          user.role as RlsRole,
          async (tx) => {
            const app = await getCurrentApplicationForUser(tx, user.id);
            let completed = 0;
            if (app) {
              const statuses = await getSectionStatusList(tx, app.id);
              completed = statuses.filter((s) => s.isComplete).length;
            }
            return { app, completed };
          }
        );

        // Invitation lookup needs admin context — the helper auto-accepts a
        // PENDING first-year invitation on first sight (a write the app_user
        // role is not granted under RLS), but deliberately leaves a PENDING
        // re-assessment invite untouched so the Begin card can consume it.
        let inv = null;
        let roundYear: string | null = null;
        if (!userScope.app) {
          inv = await withAdminContext((tx) =>
            getOrAcceptLatestInvitationForUser(tx, user.id)
          );
          // Re-assessment cards need the new round's academic year for the
          // "welcome back" copy.
          if (inv?.bursaryAccountId && inv.roundId) {
            const round = await withAdminContext((tx) =>
              tx.round.findUnique({
                where: { id: inv!.roundId! },
                select: { academicYear: true },
              })
            );
            roundYear = round?.academicYear ?? null;
          }
        }

        return {
          application: userScope.app,
          completedSections: userScope.completed,
          invitation: inv,
          inviteRoundYear: roundYear,
        };
      })()
    : {
        application: null,
        completedSections: 0,
        invitation: null,
        inviteRoundYear: null,
      };

  const isDraft = application?.status === "PRE_SUBMISSION";

  const progressPercent = application
    ? Math.round((completedSections / TOTAL_SECTIONS) * 100)
    : 0;

  const roundLabel = application?.round?.academicYear
    ? `${application.round.academicYear} Assessment Round`
    : "Bursary Application";

  return (
    <div className="space-y-8">
      {/* Welcome heading */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900 md:text-3xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {application
            ? isDraft
              ? `${roundLabel} — continue your bursary application below.`
              : `${roundLabel} — view your application status below.`
            : "Your bursary portal is ready."}
        </p>
      </div>

      {application ? (
        <>
          {/* Application status card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Application status
                </p>
                <p className="mt-1 text-lg font-semibold text-primary-900">
                  {roundLabel}
                </p>
                <div className="mt-3">
                  <StatusBadge status={toBadgeStatus(application.status)} />
                </div>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <ClipboardList
                  className="h-6 w-6 text-primary-700"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Progress summary — only meaningful while the draft is editable */}
            {isDraft && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Sections complete</span>
                  <span className="font-medium text-primary-900">
                    {completedSections} of {TOTAL_SECTIONS}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-accent-600 transition-all"
                    style={{ width: `${progressPercent}%` }}
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${progressPercent}% complete`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Quick actions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Continue application — only while the draft is still editable */}
              {isDraft && (
                <a
                  href="/apply/child-details"
                  className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-900 text-white">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 group-hover:text-primary-900">
                      Continue Application
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Pick up where you left off
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary-600 transition-colors"
                    aria-hidden="true"
                  />
                </a>
              )}

              {/* View status */}
              <a
                href="/status"
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 group-hover:text-primary-900">
                    View Status
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Track your application progress
                  </p>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary-600 transition-colors"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>
        </>
      ) : invitation ? (
        invitation.bursaryAccountId ? (
          /* Returning bursary holder — re-assessment "welcome back" card. */
          <ReassessmentCard
            defaultChildName={invitation.childName}
            school={invitation.school}
            academicYear={inviteRoundYear}
          />
        ) : (
          /* First-year invitation, no Application yet — onboarding card. */
          <OnboardingCard defaultChildName={invitation.childName} />
        )
      ) : (
        /* No invitation found — neutral fallback */
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-6 w-6 text-slate-400" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            No invitation found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            We can&rsquo;t find an invitation linked to your account. Please
            contact the Foundation if you believe this is an error.
          </p>
        </div>
      )}
    </div>
  );
}
