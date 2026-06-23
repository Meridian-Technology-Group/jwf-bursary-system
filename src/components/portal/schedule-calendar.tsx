/**
 * Gap F2 — read-only Year 6 → Year 13 bursary schedule calendar (canonical §10).
 *
 * A STANDING, informational reassurance view for ACTIVE families: one row per
 * academic year across the full Year 6 → Year 13 span, with out-of-award /
 * not-yet-opened years GREYED and the current/next assessment year MARKED.
 *
 * Strictly read-only: NO buttons, NO links into prior application data. (The
 * "invited to reassess" CTA is the separate `ReassessmentCard`; this is the
 * always-on schedule.)
 *
 * a11y: each row's state is conveyed by VISIBLE text + an `aria-label`, never by
 * colour alone (the gold-on-navy "current" / greyed-out styling is paired with a
 * text state label — the same pattern as the admin schedule grid). This is a
 * pure server component (no client interactivity), so it carries no
 * `"use client"` directive.
 */

import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalScheduleRow } from "@/lib/bursary-accounts/portal-schedule";

interface ScheduleCalendarProps {
  rows: PortalScheduleRow[];
}

/** Per-state row styling. State is ALSO surfaced as text, never colour alone. */
const ROW_CLASS: Record<PortalScheduleRow["state"], string> = {
  current: "border-accent-500 bg-accent-50",
  active: "border-slate-200 bg-white",
  greyed: "border-slate-100 bg-slate-50",
};

/** Per-state badge styling for the visible state label. */
const BADGE_CLASS: Record<PortalScheduleRow["state"], string> = {
  current: "bg-primary-900 text-white",
  active: "border border-slate-200 bg-white text-slate-600",
  greyed: "border border-slate-200 bg-slate-100 text-slate-400",
};

export function ScheduleCalendar({ rows }: ScheduleCalendarProps) {
  return (
    <ol
      className="space-y-2"
      aria-label="Year 6 to Year 13 bursary assessment schedule"
    >
      {rows.map((row) => {
        const isGreyed = row.state === "greyed";
        // OTHER/unknown entry groups have no real school year (schoolYear null);
        // the "Year N" label is omitted so we never contradict the Yr6→13 frame.
        const yearLabel = row.schoolYear != null ? `Year ${row.schoolYear}` : null;
        return (
          <li
            key={row.academicYear}
            className={cn(
              "flex items-center justify-between gap-4 rounded-lg border px-4 py-3",
              ROW_CLASS[row.state]
            )}
            // State conveyed to assistive tech in words, not by colour.
            aria-label={`${
              yearLabel ? `${yearLabel}, ` : ""
            }${row.academicYear}: ${row.stateLabel}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <CalendarRange
                className={cn(
                  "h-4 w-4 shrink-0",
                  row.state === "current"
                    ? "text-accent-700"
                    : isGreyed
                      ? "text-slate-300"
                      : "text-slate-400"
                )}
                aria-hidden="true"
              />
              <div className="min-w-0">
                {yearLabel ? (
                  <>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        row.state === "current"
                          ? "text-primary-900"
                          : isGreyed
                            ? "text-slate-400"
                            : "text-slate-700"
                      )}
                    >
                      {yearLabel}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        isGreyed ? "text-slate-300" : "text-slate-500"
                      )}
                    >
                      {row.academicYear} academic year
                    </p>
                  </>
                ) : (
                  // No deterministic school year (OTHER/unknown entry group):
                  // promote the academic year to the row's primary label so we
                  // never show a misleading "Year N".
                  <p
                    className={cn(
                      "text-sm font-medium",
                      row.state === "current"
                        ? "text-primary-900"
                        : isGreyed
                          ? "text-slate-400"
                          : "text-slate-700"
                    )}
                  >
                    {row.academicYear} academic year
                  </p>
                )}
              </div>
            </div>

            {/* Visible state label — paired with the row styling so state is
                never colour-alone. Mirrors the aria-label above. */}
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                BADGE_CLASS[row.state]
              )}
            >
              {row.stateLabel}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
