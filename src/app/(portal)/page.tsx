/**
 * Applicant portal dashboard.
 *
 * Shown after login. Displays a welcome message, application status card,
 * and quick action buttons.
 */

import { getCurrentUser } from "@/lib/auth/roles";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileText, ArrowRight, ClipboardList } from "lucide-react";

export const metadata = {
  title: "My Application",
};

export default async function PortalDashboardPage() {
  const user = await getCurrentUser();
  const firstName = user?.firstName ?? "there";

  return (
    <div className="space-y-8">
      {/* Welcome heading */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900 md:text-3xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          2024–25 Assessment Round — continue your bursary application below.
        </p>
      </div>

      {/* Application status card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Application status
            </p>
            <p className="mt-1 text-lg font-semibold text-primary-900">
              2024–25 Bursary Application
            </p>
            <div className="mt-3">
              <StatusBadge status="IN_REVIEW" />
            </div>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <ClipboardList
              className="h-6 w-6 text-primary-700"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Progress summary */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Sections complete</span>
            <span className="font-medium text-primary-900">1 of 10</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full w-[10%] rounded-full bg-accent-600"
              role="progressbar"
              aria-valuenow={10}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="10% complete"
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
          {/* Continue application */}
          <a
            href="/application/personal-details"
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

          {/* View status */}
          <a
            href="/application/status"
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
    </div>
  );
}
