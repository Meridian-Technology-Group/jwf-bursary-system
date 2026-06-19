/**
 * RoundProgressGauge — the time/progress instrument for the Round Cockpit (#18).
 *
 * "Day N of M · D days to close", a Progress bar for the open→close window, and
 * the decisions/day required to clear the undecided backlog (with the actual
 * pace as muted context).
 *
 * Pure presentational Server Component. Handles the closed / past-close case
 * gracefully: the bar reads full, no "required" pace is shown (the window is
 * over), and the headline switches to a "closed" read.
 */

import { CalendarClock, Gauge } from "lucide-react";
import type { TimeProgress } from "@/lib/db/queries/round-cockpit";

interface RoundProgressGaugeProps {
  timeProgress: TimeProgress;
}

export function RoundProgressGauge({ timeProgress }: RoundProgressGaugeProps) {
  const {
    dayN,
    totalDays,
    daysToClose,
    undecided,
    decisionsPerDayRequired,
    decisionsPerDayActual,
  } = timeProgress;

  const isClosed = daysToClose <= 0;
  const pct = Math.min(100, Math.max(0, Math.round((dayN / totalDays) * 100)));
  const barPct = isClosed ? 100 : pct;

  return (
    <section
      aria-labelledby="round-progress-heading"
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <CalendarClock
          className="h-4 w-4 text-slate-400"
          aria-hidden="true"
        />
        <h2
          id="round-progress-heading"
          className="text-base font-medium text-primary-900"
        >
          Time &amp; Progress
        </h2>
      </div>

      {/* Headline: day-N-of-M · days to close */}
      <p className="mt-3 text-sm text-slate-600">
        {isClosed ? (
          <span className="font-medium text-slate-700">Round closed</span>
        ) : (
          <>
            <span className="font-semibold tabular-nums text-primary-900">
              Day {dayN}
            </span>{" "}
            of <span className="tabular-nums">{totalDays}</span>
            <span className="mx-2 text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="tabular-nums">
              {daysToClose} {daysToClose === 1 ? "day" : "days"}
            </span>{" "}
            to close
          </>
        )}
      </p>

      {/* Progress bar through the open→close window */}
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={barPct}
        aria-label={
          isClosed
            ? "Round window complete"
            : `Day ${dayN} of ${totalDays}, ${barPct}% through the round window`
        }
      >
        <div
          className="h-full rounded-full bg-accent-600 transition-all"
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* Decisions/day required vs actual */}
      <div className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4">
        <Gauge className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
          {isClosed || decisionsPerDayRequired <= 0 ? (
            <p className="text-sm text-slate-600">
              {undecided > 0 ? (
                <>
                  <span className="font-medium tabular-nums text-primary-900">
                    {undecided}
                  </span>{" "}
                  still undecided
                </>
              ) : (
                <span className="font-medium text-emerald-700">
                  All applications decided
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-700">
              <span className="font-semibold tabular-nums text-primary-900">
                ≈{decisionsPerDayRequired}
              </span>{" "}
              decisions/day required
              <span className="ml-1 text-slate-400">
                ({undecided} undecided)
              </span>
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            Current pace:{" "}
            <span className="tabular-nums">{decisionsPerDayActual}</span>{" "}
            decisions/day
          </p>
        </div>
      </div>
    </section>
  );
}
