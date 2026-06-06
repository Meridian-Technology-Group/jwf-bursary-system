/**
 * Account history (Epic 05 §3.4).
 *
 * Expands the portal from "your one application" into a multi-round account
 * view: every application/round for this lead applicant, newest first, each
 * with its parent-safe status and — for submitted ones — a preserved read-only
 * PDF download. Prior years are reference-only and never re-open as editable
 * forms. For active recipients, the upcoming-rounds lineup is shown (Epic 10
 * generates the schedule; an empty state is shown until then).
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  History as HistoryIcon,
  CalendarClock,
  FileText,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import type { RlsRole } from "@/lib/db/prisma";
import { loadAccountHistory } from "@/lib/portal/account-history";
import { parentToneBadgeClass } from "@/lib/portal/status-projection";
import { formatLondonDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Application History",
};

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const history = await loadAccountHistory({
    id: user.id,
    role: user.role as RlsRole,
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Your account
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Application history
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Every bursary application on your account, across assessment rounds.
          Past applications are read-only — you can download a copy of anything
          you submitted.
        </p>
      </div>

      {/* History list */}
      {history.entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <HistoryIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            No applications yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            When you start a bursary application it will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {history.entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText
                      className="h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-primary-900">
                      {entry.academicYear} assessment round
                    </p>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {entry.reference}
                  </p>
                  {entry.childName && (
                    <p className="text-sm text-slate-600">{entry.childName}</p>
                  )}
                  {entry.submittedAt && (
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {formatLondonDate(entry.submittedAt)}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                      parentToneBadgeClass(entry.status.tone)
                    )}
                  >
                    {entry.status.label}
                  </span>

                  {!entry.isDraft ? (
                    <a
                      href={`/api/pdf/submission/${entry.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download PDF
                    </a>
                  ) : (
                    <Link
                      href="/apply/child-details"
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                    >
                      Continue
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Upcoming-rounds lineup (active recipients) */}
      {history.hasActiveBursary && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarClock
              className="h-4 w-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Upcoming re-assessments
            </h2>
          </div>
          {history.upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Your bursary is reviewed each year. When the next re-assessment
              round is scheduled, it will be listed here and you&rsquo;ll be
              invited by email.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.upcoming.map((round) => (
                <li
                  key={round.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-sm"
                >
                  <span className="font-medium text-slate-700">
                    {round.academicYear}
                  </span>
                  <span className="text-xs text-slate-500">Scheduled</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>
    </div>
  );
}
