/**
 * Round Detail — the Round Cockpit (#18, Stage D).
 *
 * Server component — requires ADMIN, ASSESSOR or VIEWER role.
 *
 * Gives admins a CRM-like situational read of a single round:
 *   header + stage strip · Needs-Attention lane · 4 pipeline tiles ·
 *   time/progress gauge · outcomes split · school breakdown ·
 *   export readiness · activity feed.
 *
 * All data comes from ONE `getRoundCockpit(tx, id)` bundle (which itself wraps
 * `getRound` + `getRoundWatchlist`, so neither is called again here) plus the
 * activity feed and the active-bursary-holder count `RoundDetailActions` needs.
 */

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  Send,
  Inbox,
  Loader2,
  Gavel,
  Archive,
  School as SchoolIcon,
} from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getRoundCockpit } from "@/lib/db/queries/round-cockpit";
import { getActiveBursaryHolders } from "@/lib/db/queries/invitations";
import { getDashboardFeed } from "@/lib/db/queries/reports";
import { RoundDetailActions } from "@/components/admin/round-detail-actions";
import { RoundStatusBadge } from "@/components/admin/round-status-badge";
import { StatTile, type TileConfig } from "@/components/admin/stat-tile";
import { ActivityFeed } from "@/components/admin/charts/activity-feed";
import { NeedsAttentionLane } from "@/components/rounds/needs-attention-lane";
import { RoundStageStrip } from "@/components/rounds/round-stage-strip";
import { RoundProgressGauge } from "@/components/rounds/round-progress-gauge";
import { RoundOutcomesBar } from "@/components/rounds/round-outcomes-bar";
import { ExportReadinessPanel } from "@/components/rounds/export-readiness-panel";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  return { title: `Round ${params.id}` };
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RoundDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const [cockpit, activeBursaryHolders, feed] = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      Promise.all([
        getRoundCockpit(tx, params.id),
        getActiveBursaryHolders(tx, params.id),
        getDashboardFeed(tx, params.id),
      ])
  );

  if (!cockpit) notFound();

  const {
    round,
    watchlist,
    pipeline,
    timeProgress,
    outcomes,
    outcomesDelta,
    exportReadiness,
    stageStrip,
  } = cockpit;

  const isClosed = round.status === "CLOSED";

  // Pipeline tile configs — clickable when a drill-in href is available.
  const pipelineTiles: Array<{ config: TileConfig; count: number }> = [
    {
      count: pipeline.invited.count,
      config: {
        label: "Invited",
        subLabel: "Pending invitations",
        icon: Send,
        iconBg: "bg-primary-50",
        iconColor: "text-primary-700",
        borderAccent: "border-slate-200",
        href: pipeline.invited.drillHref ?? undefined,
      },
    },
    {
      count: pipeline.submitted.count,
      config: {
        label: "Submitted",
        subLabel: "Awaiting assessment",
        icon: Inbox,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        borderAccent: "border-slate-200",
        href: pipeline.submitted.drillHref ?? undefined,
      },
    },
    {
      count: pipeline.inAssessment.count,
      config: {
        label: "In Assessment",
        subLabel: "Being assessed",
        icon: Loader2,
        iconBg: "bg-orange-50",
        iconColor: "text-orange-600",
        borderAccent: "border-slate-200",
        href: pipeline.inAssessment.drillHref ?? undefined,
      },
    },
    {
      count: pipeline.decided.count,
      config: {
        label: "Decided",
        subLabel: "Qualifies + does not qualify",
        icon: Gavel,
        iconBg: "bg-green-50",
        iconColor: "text-green-600",
        borderAccent: "border-slate-200",
        href: pipeline.decided.drillHref ?? undefined,
      },
    },
  ];

  const daysToCloseLabel =
    round.status === "OPEN" && timeProgress.daysToClose > 0
      ? `Closes in ${timeProgress.daysToClose} ${
          timeProgress.daysToClose === 1 ? "day" : "days"
        }`
      : null;

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-primary-900">
                Round {round.academicYear}
              </h1>
              <RoundStatusBadge status={round.status} />
              {daysToCloseLabel && (
                <span className="inline-flex items-center rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700">
                  {daysToCloseLabel}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
              <span>
                Opens:{" "}
                <span className="font-medium text-slate-700">
                  {formatDate(round.openDate)}
                </span>
              </span>
              <span>
                Closes:{" "}
                <span className="font-medium text-slate-700">
                  {formatDate(round.closeDate)}
                </span>
              </span>
              {round.decisionDate && (
                <span>
                  Decision:{" "}
                  <span className="font-medium text-slate-700">
                    {formatDate(round.decisionDate)}
                  </span>
                </span>
              )}
            </div>
          </div>

          <RoundDetailActions
            roundId={round.id}
            academicYear={round.academicYear}
            status={round.status}
            activeBursaryHolderCount={activeBursaryHolders.length}
          />
        </div>

        {/* Closed-round notice — calm, neutral; archived for reference. */}
        {isClosed && (
          <Alert className="border-slate-200 bg-slate-50 text-slate-600">
            <Archive className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <AlertTitle className="text-slate-700">Round closed</AlertTitle>
            <AlertDescription className="text-slate-500">
              This round is closed — archived for reference.
            </AlertDescription>
          </Alert>
        )}

        {/* Stage strip — pure status instrument, renders for every status. */}
        <div
          className={`rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm${
            isClosed ? " opacity-90" : ""
          }`}
        >
          <RoundStageStrip stages={stageStrip} />
        </div>
      </header>

      {/* ── Top grid: Needs-Attention (left) · Pipeline tiles (right) ─────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NeedsAttentionLane rules={watchlist.rules} />

        <section aria-label="Application pipeline">
          <h2 className="sr-only">Pipeline</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pipelineTiles.map((tile) => (
              <StatTile
                key={tile.config.label}
                config={tile.config}
                count={tile.count}
              />
            ))}
          </div>
        </section>
      </div>

      {/* ── Mid grid: Progress gauge · Outcomes ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RoundProgressGauge timeProgress={timeProgress} />
        <RoundOutcomesBar outcomes={outcomes} delta={outcomesDelta} />
      </div>

      {/* ── School split · Export readiness ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="school-split-heading"
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <SchoolIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2
              id="school-split-heading"
              className="text-base font-medium text-primary-900"
            >
              Applications by School
            </h2>
          </div>
          {round.schoolBreakdown.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
              No applications yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {round.schoolBreakdown.map(({ school, count }) => (
                <li
                  key={school}
                  className="flex items-center justify-between py-3"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {school}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-primary-900">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ExportReadinessPanel
          exportReadiness={exportReadiness}
          roundId={round.id}
        />
      </div>

      {/* ── Activity feed ────────────────────────────────────────────────── */}
      <section
        aria-labelledby="activity-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2
          id="activity-heading"
          className="mb-3 text-base font-medium text-primary-900"
        >
          Recent Activity
        </h2>
        <ActivityFeed items={feed} />
      </section>
    </div>
  );
}
