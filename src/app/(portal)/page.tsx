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

import { redirect } from "next/navigation";
import type { ApplicationSectionType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/roles";
import { withAdminContext, withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getCurrentApplicationForUser, getSectionStatusList } from "@/lib/db/queries/applications";
import {
  getSecondaryContributorContext,
  resolveOwningContributorId,
} from "@/lib/db/queries/contributors";
import { getOrAcceptLatestInvitationForUser } from "@/lib/db/queries/invitations";
import { projectFormStatusForApplicant } from "@/components/shared/lifecycle-badges";
import { ApplicationTypeChooser } from "@/app/(portal)/application-type-chooser";
import { PortalPage } from "@/components/portal/portal-page";
import { SubmissionCountdown } from "@/components/portal/submission-countdown";
import {
  effectiveSubmissionDeadline,
  isSubmissionDeadlinePassed,
} from "@/lib/rounds/submission-deadline";
import { isRollingOverApplication } from "@/lib/db/queries/reassessment";
import {
  SECTION_ORDER,
  SECTION_TO_SLUG,
  SECTION_TITLES,
} from "@/lib/portal/sections";
import {
  FileText,
  ArrowRight,
  ClipboardList,
  Upload,
  Lock,
  History,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "My Application",
};

// All form sections in workbook order come from the canonical SECTION_ORDER
// (single source of truth). The active set for a given application excludes
// FAMILY_ID for a rolling-over re-assessment (Epic 02); the dashboard progress
// count + denominator both derive from this so they always agree.
const TOTAL_SECTIONS = SECTION_ORDER.length;

export default async function PortalDashboardPage() {
  const user = await getCurrentUser();
  const firstName = user?.firstName ?? "there";

  // Dual-parent (PR 4b): a SECONDARY contributor is not a lead applicant and
  // owns no application — they were invited to supply their financials on a
  // child's application owned by the primary parent. Detect this FIRST and send
  // them to their restricted /contribute flow so they never see (or attempt)
  // the full applicant wizard. The lookup runs under their own RLS context; the
  // secondary may SELECT their own contributor row.
  //
  // Guard: only redirect when they are NOT also a lead applicant of their own
  // application — a person who is primary on one child's application keeps their
  // primary dashboard (their /contribute flow remains reachable directly).
  if (user) {
    const routing = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const ownApp = await tx.application.findFirst({
          where: { leadApplicantId: user.id },
          select: { id: true },
        });
        if (ownApp) return { redirectToContribute: false };
        const secondary = await getSecondaryContributorContext(tx, user.id);
        return { redirectToContribute: secondary !== null };
      }
    );
    if (routing.redirectToContribute) {
      redirect("/contribute");
    }
  }

  const {
    application,
    completedSections,
    totalSections,
    deadlinePast,
    deadlineIso,
    nextSection,
    invitation,
    inviteRoundYear,
  } = user
    ? await (async () => {
        const userScope = await withUserContext(
          user.id,
          user.role as RlsRole,
          async (tx) => {
            const app = await getCurrentApplicationForUser(tx, user.id);
            let completed = 0;
            let totalSections = TOTAL_SECTIONS;
            let deadlinePast = false;
            let deadlineIso: string | null = null;
            // First section (in active order) the applicant still has to finish.
            // Drives the "Continue where you left off — Next: {section}" deep
            // link on the draft dashboard. Null once every active section is
            // complete (then the Continue card falls back to the first section).
            let nextSection: ApplicationSectionType | null = null;
            if (app) {
              // The active section set excludes the ID section for a rolling-over
              // application (Epic 02). The progress DENOMINATOR must match — the
              // old hard-coded "of 10" mismatched the 9 active sections and the
              // completed count, which is the Epic-12 §3 progress-count bug. Both
              // numerator and denominator now read the same active-section set.
              const rollingOver = isRollingOverApplication(app);
              const activeSections = rollingOver
                ? SECTION_ORDER.filter((s) => s !== "FAMILY_ID")
                : SECTION_ORDER;
              totalSections = activeSections.length;

              // Scope the progress count to the lead applicant's PRIMARY
              // contributor (dual-parent foundation). Resolve with a SELECT —
              // never upsert under applicant RLS (admin-only write policy). The
              // PRIMARY contributor is created at application creation; if it is
              // somehow absent the count stays 0 here and the write path
              // self-heals it. For a single parent this is every section, so
              // the count is unchanged.
              const ownerContributorId = await resolveOwningContributorId(
                tx,
                app.id,
                user.id
              );
              if (ownerContributorId) {
                const statuses = await getSectionStatusList(
                  tx,
                  app.id,
                  ownerContributorId
                );
                const activeSet = new Set<string>(activeSections);
                completed = statuses.filter(
                  (s) => s.isComplete && activeSet.has(s.section)
                ).length;

                // First incomplete active section, in workbook order — the
                // deep-link target for "Continue where you left off". A section
                // with no status row yet counts as incomplete.
                const completeSet = new Set<string>(
                  statuses.filter((s) => s.isComplete).map((s) => s.section)
                );
                nextSection =
                  activeSections.find((s) => !completeSet.has(s)) ?? null;
              }

              // Resolve the effective submission deadline (Epic 03) for the
              // countdown / lockout. Only meaningful while still an editable
              // draft. Needs the round close date, which the shared query does
              // not select — fetch it narrowly here.
              if (app.formStatus !== "SUBMITTED") {
                const round = await tx.round.findUnique({
                  where: { id: app.roundId },
                  select: { closeDate: true },
                });
                if (round) {
                  const { deadline } = effectiveSubmissionDeadline(
                    { submissionDeadlineAt: app.submissionDeadlineAt },
                    { closeDate: round.closeDate }
                  );
                  deadlineIso = deadline.toISOString();
                  deadlinePast = isSubmissionDeadlinePassed(
                    { submissionDeadlineAt: app.submissionDeadlineAt },
                    { closeDate: round.closeDate }
                  );
                }
              }
            }
            return {
              app,
              completed,
              totalSections,
              deadlinePast,
              deadlineIso,
              nextSection,
            };
          }
        );

        // Invitation lookup needs admin context — the helper auto-accepts a
        // PENDING first-year invitation on first sight (a write the app_user
        // role is not granted under RLS), but deliberately leaves a PENDING
        // re-assessment invite untouched so the Begin card can consume it.
        //
        // We must run this even when the holder already has an application:
        // getCurrentApplicationForUser returns their most-recent app of ANY
        // round/status, which for a returning bursary holder is last year's
        // (completed) application. Without checking for a pending re-assessment
        // invite here, the dashboard would show that prior-year app and the
        // "Begin re-assessment" card would never appear (the re-assessment
        // dead-end). So we always fetch the invite, then below decide whether a
        // pending re-assessment for a not-yet-started round should take over.
        const inv = await withAdminContext((tx) =>
          getOrAcceptLatestInvitationForUser(tx, user.id)
        );

        // A pending re-assessment invite (non-null bursaryAccountId) only takes
        // over the dashboard when the holder has NOT yet created an application
        // in that invite's round. Once they click Begin, a current-round app
        // exists and we fall back to showing its progress instead.
        let hasAppInInviteRound = false;
        if (
          inv?.bursaryAccountId &&
          inv.status === "PENDING" &&
          inv.roundId
        ) {
          hasAppInInviteRound = await withUserContext(
            user.id,
            user.role as RlsRole,
            async (tx) => {
              const roundApp = await tx.application.findFirst({
                where: { leadApplicantId: user.id, roundId: inv.roundId! },
                select: { id: true },
              });
              return roundApp !== null;
            }
          );
        }

        const showReassessment =
          !!inv?.bursaryAccountId &&
          inv.status === "PENDING" &&
          !hasAppInInviteRound;

        // Re-assessment cards need the new round's academic year for the
        // "welcome back" copy. Fetch it only when the card will actually show.
        let roundYear: string | null = null;
        if (showReassessment && inv?.roundId) {
          const round = await withAdminContext((tx) =>
            tx.round.findUnique({
              where: { id: inv.roundId! },
              select: { academicYear: true },
            })
          );
          roundYear = round?.academicYear ?? null;
        }

        return {
          // When a pending re-assessment should take over, suppress the
          // prior-year application so the dashboard falls through to the card.
          application: showReassessment ? null : userScope.app,
          completedSections: userScope.completed,
          totalSections: userScope.totalSections,
          deadlinePast: userScope.deadlinePast,
          deadlineIso: userScope.deadlineIso,
          nextSection: showReassessment ? null : userScope.nextSection,
          invitation: showReassessment || !userScope.app ? inv : null,
          inviteRoundYear: roundYear,
        };
      })()
    : {
        application: null,
        completedSections: 0,
        totalSections: TOTAL_SECTIONS,
        deadlinePast: false,
        deadlineIso: null,
        nextSection: null,
        invitation: null,
        inviteRoundYear: null,
      };

  const isDraft =
    application != null && application.formStatus !== "SUBMITTED";
  // Past-deadline lockout (Epic 05 §3.2): only meaningful while still drafting.
  const isLockedOut = isDraft && deadlinePast;

  const progressPercent = application
    ? Math.round((completedSections / totalSections) * 100)
    : 0;

  const roundLabel = application?.round?.academicYear
    ? `${application.round.academicYear} Assessment Round`
    : "Bursary Application";

  // Deep-link + label for the "Continue where you left off" primary card. Point
  // at the first incomplete active section when known; otherwise fall back to
  // the first section (existing behaviour). Mirrors proposal §2.6.
  const continueSlug = nextSection
    ? SECTION_TO_SLUG[nextSection]
    : "child-details";
  const continueHref = `/apply/${continueSlug}`;
  const nextSectionTitle = nextSection ? SECTION_TITLES[nextSection] : null;

  // Tiered help (Decision 7): a quiet "Need help?" link row used in every state
  // EXCEPT "invited, not started", where the help affordance is elevated for
  // first-timers (the bordered card under the chooser, below). All point at the
  // single guidance page that PR-4 stood up.
  const quietHelpLink = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <span className="text-slate-500">Need help? </span>
      <Link
        href="/help"
        className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800"
      >
        How to apply &middot; Checklist &middot; Terms &amp; Conditions
      </Link>
    </div>
  );

  return (
    <PortalPage className="space-y-8">
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
          {/* Submission countdown / deadline-missed lockout (Epic 05 §3.2).
              Only while the form is still an editable draft; keyed on the
              effective per-application deadline (Epic 03). */}
          {isDraft && deadlineIso && (
            <SubmissionCountdown deadlineIso={deadlineIso} />
          )}

          {/* Paused — missing documents call to action */}
          {application.assessment?.status === "PAUSED" && (
            <Link
              href="/respond"
              className="group flex items-start gap-4 rounded-xl border border-yellow-300 bg-yellow-50 p-6 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                <Upload className="h-6 w-6 text-yellow-700" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-yellow-900">
                  Action needed: respond to a document request
                </p>
                <p className="mt-1 text-sm text-yellow-800">
                  An assessor has asked for more documents. Upload them to get
                  your assessment moving again.
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-yellow-500 group-hover:text-yellow-700 transition-colors"
                aria-hidden="true"
              />
            </Link>
          )}

          {/* Continue where you left off — the state primary for an editable
              draft (proposal §2.3/§2.6). Lifted above the status card so the
              next action is the first thing a returning parent sees; reuses the
              section count already in scope and deep-links to the first
              incomplete section. Hidden once the deadline passes (the locked
              card in Quick actions takes over). */}
          {isDraft && !isLockedOut && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Continue where you left off
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary-900">
                    {completedSections} of {totalSections} sections complete
                  </p>
                  {nextSectionTitle && (
                    <p className="mt-1 text-sm text-slate-500">
                      Next: {nextSectionTitle}
                    </p>
                  )}
                </div>
                <a
                  href={continueHref}
                  className="group inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                >
                  Continue
                  <ArrowRight
                    className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>
              <div className="mt-5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
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
            </div>
          )}

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
                  {/* Parent-safe label (Epic 01): never surfaces internal
                      assessment/outcome states. Epic 05 owns the full portal
                      status UX. */}
                  <span className="status-badge border bg-primary-50 border-primary-200 text-primary-800">
                    {projectFormStatusForApplicant(
                      application.formStatus,
                      application.applicationType
                    )}
                  </span>
                </div>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <ClipboardList
                  className="h-6 w-6 text-primary-700"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Quick actions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* The draft "Continue" primary now lives in the lead card above
                  (proposal §2.6). Past the deadline the action is removed and a
                  locked card is shown here instead (presentation; the server
                  submit guard is authoritative). */}
              {isDraft && isLockedOut && (
                <div className="flex items-center gap-4 rounded-xl border border-dashed border-rose-200 bg-rose-50 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                    <Lock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-rose-900">
                      Submission closed
                    </p>
                    <p className="mt-0.5 text-sm text-rose-700">
                      The deadline has passed — this application can no longer be
                      edited or submitted.
                    </p>
                  </div>
                </div>
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

              {/* Application history (multi-round account view, Epic 05 §3.4) */}
              <a
                href="/history"
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <History className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 group-hover:text-primary-900">
                    Application History
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    View past rounds &amp; download submissions
                  </p>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary-600 transition-colors"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>

          {/* Quiet help link — demoted off the fold (Decision 7). */}
          {quietHelpLink}
        </>
      ) : invitation ? (
        /* No application yet, but an invitation exists ("invited, not started").
           Show BOTH application types as mutually-exclusive cards (feedback #4):
           the type matching the invitation is active, the other is disabled with
           a reason so a parent can never start the wrong form. Eligibility is
           derived from the invitation (re-assessment ⇒ ROLLING_OVER), never
           chosen here. The chooser stays front-and-centre; the help affordance
           below is the one ELEVATED tier (Decision 7) — first-timers benefit
           most from the guidance before they start. */
        <>
          <ApplicationTypeChooser
            eligibleType={invitation.bursaryAccountId ? "ROLLING_OVER" : "NEW"}
            defaultChildName={invitation.childName}
            school={invitation.school}
            academicYear={inviteRoundYear}
          />

          {/* Elevated help card (Decision 7) — same destination as the quiet
              link, more prominence for first-timers. NOTE: this is currently
              shown for ALL invited-not-started parents, including re-assessment
              (ROLLING_OVER) invitations who have done this before. Product may
              later want to gate elevation to NEW applicants only. */}
          <div className="rounded-xl border border-accent-400 bg-accent-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                <HelpCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-primary-900">
                  New to bursary applications?
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Read how to apply, the document checklist, and the bursary
                  terms &amp; conditions before you begin.
                </p>
                <Link
                  href="/help"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent-400 bg-white px-3.5 py-2 text-sm font-medium text-accent-700 shadow-sm transition-colors hover:bg-accent-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                >
                  Read the guidance
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* No invitation found — neutral fallback */
        <>
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

          {/* Quiet help link — guidance is still reachable here (Decision 7). */}
          {quietHelpLink}
        </>
      )}
    </PortalPage>
  );
}
