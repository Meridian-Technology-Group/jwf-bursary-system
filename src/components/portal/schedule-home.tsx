/**
 * Epic 14 D3 (CG-02) — the Bursary Application Schedule blocks a returning
 * parent lands on: one block per child (bursary account), one row per
 * academic year with the year's dates and a single state cell.
 *
 * Server component — rows are pre-derived by `buildScheduleHomeRows`; this
 * only renders. Buttons:
 *   CONTINUE          → /apply/open/{applicationId} (E2): sets the explicit
 *                       active-application context, then enters the wizard —
 *                       so any child's draft is resumable from here.
 *   START APPLICATION → anchors to the start affordance below (the type
 *                       chooser / re-assessment card) when one is rendered;
 *                       inert otherwise (nothing on the page could start it).
 *   SUBMITTED / LOCKED / CLOSED → labels only.
 */

import { CalendarRange, Lock } from "lucide-react";
import type { School } from "@prisma/client";
import type { ScheduleHomeRow } from "@/lib/bursary-accounts/schedule-home";
import { schoolLabel } from "@/lib/contacts/contact-helpers";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function fmt(d: Date | null): string {
  return d ? dateFormat.format(d) : "—";
}

export interface ScheduleHomeBlock {
  accountId: string;
  childName: string;
  school: School;
  rows: ScheduleHomeRow[];
}

interface ScheduleHomeProps {
  blocks: ScheduleHomeBlock[];
  /** True when the page renders a start affordance to anchor to. */
  hasStartAffordance: boolean;
}

function StateCell({
  row,
  hasStartAffordance,
}: {
  row: ScheduleHomeRow;
  hasStartAffordance: boolean;
}) {
  if (row.state === "continue" || row.state === "start") {
    const href =
      row.state === "continue"
        ? row.applicationId != null
          ? `/apply/open/${row.applicationId}`
          : null
        : hasStartAffordance
          ? "#start-application"
          : null;
    if (href) {
      return (
        <a
          href={href}
          className="inline-flex items-center rounded-lg bg-primary-900 px-3 py-1.5 text-xs font-semibold tracking-wide text-white shadow-sm transition-colors hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          {row.stateLabel}
        </a>
      );
    }
    return (
      <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500">
        {row.stateLabel}
      </span>
    );
  }
  if (row.state === "submitted") {
    return (
      <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-700">
        {row.stateLabel}
      </span>
    );
  }
  // locked / closed — inert, never colour-only.
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-400">
      {row.state === "locked" && (
        <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
      )}
      {row.stateLabel}
    </span>
  );
}

export function ScheduleHome({ blocks, hasStartAffordance }: ScheduleHomeProps) {
  return (
    <section aria-label="Bursary application schedule" className="space-y-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        <CalendarRange className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Bursary Application Schedule
      </h2>

      {blocks.map((block) => (
        <div
          key={block.accountId}
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-6 py-4">
            <p className="font-semibold text-primary-900">{block.childName}</p>
            <p className="text-sm text-slate-500">{schoolLabel(block.school)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th scope="col" className="px-6 py-3">Academic year</th>
                  <th scope="col" className="px-4 py-3">School year</th>
                  <th scope="col" className="px-4 py-3">Opens</th>
                  <th scope="col" className="px-4 py-3">Submit by</th>
                  <th scope="col" className="px-4 py-3">Award news</th>
                  <th scope="col" className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {block.rows.map((row) => (
                  <tr
                    key={row.scheduleYear}
                    className={
                      row.state === "locked" || row.state === "closed"
                        ? "text-slate-400"
                        : "text-slate-700"
                    }
                  >
                    <td className="px-6 py-3 font-medium">{row.academicYear}</td>
                    <td className="px-4 py-3">
                      {row.schoolYear != null ? `Year ${row.schoolYear}` : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fmt(row.openingDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fmt(row.submissionDeadline)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fmt(row.awardCommunicationDate)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <StateCell row={row} hasStartAffordance={hasStartAffordance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
