/**
 * Epic 22 P5 (CR-002 Phase 5 #3) — My Application(s) Schedule.
 *
 * One table per child (every ACTIVE account with a portal-visible year), the
 * nine columns of Charlotte's sheet. Each section carries the anchor Home's
 * child lines link to (`#account-{id}`). Read-only: P1's My Bursary
 * Application(s) is where a family acts. No outcome is ever shown, and a year
 * the bursary team has hidden (show-on-portal off) never leaves the database.
 *
 * Replaces gap F2's single-account Year 6 → Year 13 calendar.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { PortalPage } from "@/components/portal/portal-page";
import { loadParentSchedule } from "@/lib/portal/parent-schedule-data";
import type { ParentScheduleRow } from "@/lib/portal/parent-schedule";
import { cn } from "@/lib/utils";
import { formatLondonDate } from "@/lib/datetime";
import { OVERDUE_BADGE_CLASS } from "@/lib/schedule/overdue";

export const metadata = {
  title: "My Application(s) Schedule",
};

/** Short date in London, e.g. "15 Apr 2027" — nine columns have to fit. */
function fmt(d: Date | null): string {
  return d ? formatLondonDate(d) : "";
}

const STATUS_STYLE: Record<ParentScheduleRow["status"], string> = {
  Scheduled: "bg-slate-50 text-slate-600 border-slate-200",
  "Open, not started": "bg-accent-50 text-accent-800 border-accent-200",
  "In progress": "bg-accent-50 text-accent-800 border-accent-200",
  Submitted: "bg-green-50 text-green-800 border-green-200",
  Rejected: "bg-rose-50 text-rose-800 border-rose-200",
  Overdue: OVERDUE_BADGE_CLASS,
};

const COLUMNS = [
  "Academic Year",
  "School Year",
  "School",
  "Application Opening Date",
  "Application Closing Date",
  "To be submitted by",
  "Completion Status",
  "Submission Status",
  "Submission Date",
];

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sections = await loadParentSchedule(user, new Date());
  // No ACTIVE account with a visible year: the nav item is gated the same way.
  if (sections.length === 0) redirect("/");

  return (
    // Wider than other portal pages: nine columns don't fit the 48rem cap.
    <PortalPage className="max-w-6xl space-y-8">
      <h1 className="text-2xl font-semibold text-primary-900">
        My Application(s) Schedule
      </h1>

      {sections.map((section) => (
        <section
          key={section.accountId}
          id={`account-${section.accountId}`}
          aria-labelledby={`account-${section.accountId}-heading`}
          className="scroll-mt-6 rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <h2
              id={`account-${section.accountId}-heading`}
              className="text-lg font-semibold text-primary-900"
            >
              {section.childName}
            </h2>
            <p className="text-sm text-slate-600">{section.yearLine}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2.5 align-bottom font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {section.rows.map((row) => (
                  <tr key={row.key} className="align-top">
                    <th scope="row" className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">
                      {row.academicYear}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {row.schoolYear != null ? `Year ${row.schoolYear}` : ""}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{section.school}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{fmt(row.opensOn)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{fmt(row.closesOn)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {fmt(row.submitBy)}
                      {row.hasOwnDeadline && (
                        <span className="block text-xs text-slate-500">Your own date</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{row.completion}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLE[row.status]
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{fmt(row.submissionDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </PortalPage>
  );
}
