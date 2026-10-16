/**
 * Epic 22 P1 (CR-002 Phase 5 #2) — My Bursary Application(s).
 *
 * One block per child: the family's last login (the same on every block, her
 * words: "same login time, for all sections"), how much of the form is
 * complete, and her four "I would like to…" options, each landing in the right
 * place (`applicationBlockActions` / `openTarget`). Submitted and between-round
 * children say so instead. Nothing staff-only is shown: no outcome, no notes.
 */

import { ReturnedForCorrectionBanner } from "@/components/portal/returned-for-correction-banner";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { PortalPage } from "@/components/portal/portal-page";
import { ContactBursaryTeam } from "@/components/portal/contact-bursary-team";
import { schoolName } from "@/lib/schools";
import { loadMyApplications } from "@/lib/portal/my-applications-data";
import {
  applicationBlockActions,
  formatLastLogin,
  type ApplicationBlock,
  type ApplicationBlockAction,
} from "@/lib/portal/my-applications";
import { formatCompletion } from "@/lib/portal/application-completion";
import { StartApplicationOption } from "./start-application-option";

export const metadata = {
  title: "My Bursary Application(s)",
};

function longDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function completionText(block: ApplicationBlock): string | null {
  switch (block.state.kind) {
    case "draft":
      return formatCompletion(block.state.percent);
    case "start":
      return "Not started";
    case "submitted":
      return "Submitted";
    default:
      return null;
  }
}

function ActionOption({ action }: { action: ApplicationBlockAction }) {
  if (action.enabled && action.invitationId) {
    return (
      <StartApplicationOption
        invitationId={action.invitationId}
        label={action.label}
      />
    );
  }
  if (action.enabled && action.href) {
    return (
      <a
        href={action.href}
        className="group flex w-full items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        <span className="flex-1">{action.label}</span>
        <ArrowRight
          className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </a>
    );
  }
  return (
    <div
      aria-disabled="true"
      className="w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400"
    >
      <span>{action.label}</span>
      {action.hint && (
        <span className="mt-0.5 block text-xs text-slate-500">{action.hint}</span>
      )}
    </div>
  );
}

function StatusMessage({ block }: { block: ApplicationBlock }) {
  const { state } = block;
  let icon = <CalendarClock className="h-5 w-5 text-primary-700" aria-hidden="true" />;
  let text: React.ReactNode;
  let link: React.ReactNode = null;

  switch (state.kind) {
    case "submitted":
      icon = <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" />;
      text = state.submittedAt
        ? `Submitted on ${longDate(state.submittedAt)}.`
        : "Submitted.";
      link = (
        <a
          href={`/apply/open/${state.applicationId}`}
          className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800"
        >
          View status
        </a>
      );
      break;
    case "next-year":
      text = `Your next application opens on ${longDate(state.opensOn)}.`;
      break;
    case "awaiting-invitation":
      text = `Your ${state.academicYear} application will be ready here once the bursary team sends your invitation.`;
      break;
    case "ended":
      text = state.lastAcademicYear
        ? `Your bursary runs to the end of ${state.lastAcademicYear}. There is no further application to fill in.`
        : "There is no application to fill in at the moment.";
      break;
    default:
      return null;
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="min-w-0 flex-1">
        {text} {link}
      </p>
    </div>
  );
}

export default async function MyApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { blocks, previousSignInAt, returnNotices } = await loadMyApplications(user, new Date());
  const lastLogin = formatLastLogin(previousSignInAt);

  return (
    <PortalPage className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900 md:text-3xl">
          My Bursary Application(s)
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Click on the following options to access the form.
        </p>
      </div>

      {blocks.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">
            No applications yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            We can&rsquo;t find an application or invitation for your account. If
            you believe this is an error, <ContactBursaryTeam />.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex text-sm font-medium text-accent-700 underline underline-offset-2"
          >
            Back to Home
          </Link>
        </div>
      )}

      {blocks.map((block) => {
        const actions = applicationBlockActions(block.state);
        const completion = completionText(block);
        const school = schoolName(block.school);
        return (
          <section
            key={block.key}
            aria-labelledby={`child-${block.key}`}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2
              id={`child-${block.key}`}
              className="text-lg font-semibold text-primary-900"
            >
              {block.childName}
            </h2>
            {school && <p className="text-sm text-slate-500">{school}</p>}

            {block.state.kind === "draft" && returnNotices.get(block.state.applicationId) && (
              <ReturnedForCorrectionBanner
                notice={returnNotices.get(block.state.applicationId)!}
                className="mt-4"
              />
            )}

            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Last login
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-800">
                  {lastLogin}
                </dd>
              </div>
              {completion && (
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Completion
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-800">
                    {completion}
                  </dd>
                  {block.state.kind === "draft" && (
                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                      aria-valuenow={block.state.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${block.state.percent}% complete`}
                    >
                      <div
                        className="h-full rounded-full bg-accent-600"
                        style={{ width: `${block.state.percent}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </dl>

            <div className="mt-5">
              {actions.length > 0 ? (
                <>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    What would you like to do?
                  </h3>
                  <ul className="space-y-2" role="list">
                    {actions.map((action) => (
                      <li key={action.key}>
                        <ActionOption action={action} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <StatusMessage block={block} />
              )}
            </div>
          </section>
        );
      })}
    </PortalPage>
  );
}
