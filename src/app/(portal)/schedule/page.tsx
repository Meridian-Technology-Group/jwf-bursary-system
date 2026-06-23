/**
 * Gap F2 — parent-facing Year 6 → Year 13 bursary schedule calendar (§10).
 *
 * A STANDING, read-only reassurance view for ACTIVE families: the full
 * Year 6 → Year 13 assessment span as academic-year rows, out-of-award /
 * not-yet-opened years greyed, the current/next assessment year marked.
 * Informational only — no actions, no links into prior application data.
 *
 * Auth/data path copied from `(portal)/status/page.tsx`: getCurrentUser →
 * withUserContext(user) → a portal-scoped read. The schedule query is filtered
 * to `showOnPortal` rows for the signed-in family's own ACTIVE account (RLS +
 * the explicit filter both scope it), and the span/grey/current logic is the
 * pure `buildPortalScheduleRows` helper.
 */

import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getPortalScheduleForUser } from "@/lib/db/queries/schedule";
import { buildPortalScheduleRows } from "@/lib/bursary-accounts/portal-schedule";
import { academicYearStartForDate } from "@/lib/assessment/schooling-years";
import { PortalPage } from "@/components/portal/portal-page";
import { ScheduleCalendar } from "@/components/portal/schedule-calendar";

export const metadata = {
  title: "Assessment Schedule",
};

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    getPortalScheduleForUser(tx, user.id)
  );

  // No ACTIVE account / no portal-visible schedule → nothing to reassure about;
  // send the family back to the dashboard (the nav item is gated the same way).
  if (!data || data.visibleEntries.length === 0) redirect("/");

  const rows = buildPortalScheduleRows({
    entryYearGroup: data.entryYearGroup,
    firstAssessmentYear: data.firstAssessmentYear,
    visibleEntries: data.visibleEntries,
    currentAcademicYearStart: academicYearStartForDate(),
  });

  return (
    <PortalPage className="space-y-8">
      {/* Page header */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Your bursary
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Assessment Schedule
        </h1>
        <p className="mt-2 max-w-prose text-sm text-slate-500">
          Bursaries are reviewed every year. This is your assessment schedule for
          your child&rsquo;s time at the school — from Year 6 through to Year 13.
          We&rsquo;ll email you when each year&rsquo;s assessment opens; there is
          nothing for you to do here.
        </p>
      </div>

      {/* The calendar */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <CalendarRange className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Year 6 to Year 13
        </h2>
        <ScheduleCalendar rows={rows} />
      </div>

      {/* Legend — text labels so the meaning never depends on colour alone. */}
      <p className="text-xs text-slate-400">
        Years marked <span className="font-medium text-slate-600">Outside
        your award</span> fall before your child started or after their final
        eligible year, or are not yet open. The year marked{" "}
        <span className="font-medium text-slate-600">This year&rsquo;s
        assessment</span> is the one we&rsquo;ll contact you about next.
      </p>
    </PortalPage>
  );
}
