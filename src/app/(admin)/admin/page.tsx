/**
 * Admin dashboard page — WP-18
 *
 * Server component. Displays 6 live data tiles scoped to the active round,
 * an activity feed of recent workflow events, and a status distribution chart.
 *
 * Tiles:
 *   1. Awaiting Assessment   (amber)   — SUBMITTED + NOT_STARTED
 *   2. In Progress           (orange)  — PAUSED
 *   3. Awaiting Recommendation (blue)  — assessment COMPLETED, no recommendation
 *   4. Qualifies             (emerald) — QUALIFIES applications
 *   5. Does Not Qualify      (slate)   — DOES_NOT_QUALIFY applications
 *   6. Active Round          (navy)    — round name + close date
 */

import Link from "next/link";
import {
  ClipboardList,
  Loader2,
  FileCheck2,
  CheckCircle2,
  XCircle,
  CalendarRange,
  ChevronRight,
} from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import {
  getActiveRound,
  getDashboardCounts,
  getDashboardFeed,
} from "@/lib/db/queries/reports";
import { ActivityFeed } from "@/components/admin/charts/activity-feed";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

// ─── Tile configuration ───────────────────────────────────────────────────────

interface TileConfig {
  label: string;
  subLabel: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  borderAccent: string;
  href?: string;
}

// ─── Stat tile card ───────────────────────────────────────────────────────────

function StatTile({
  config,
  count,
}: {
  config: TileConfig;
  count: number | string;
}) {
  const Icon = config.icon;

  const inner = (
    <div
      className={cn(
        "group flex items-start gap-4 rounded-xl border bg-white p-6 shadow-sm transition-shadow",
        config.borderAccent,
        config.href
          ? "hover:shadow-md cursor-pointer"
          : "cursor-default"
      )}
    >
      {/* Icon badge */}
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
          config.iconBg
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-5 w-5", config.iconColor)} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-500">{config.label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-primary-900">
          {count}
        </p>
        <p className="mt-1 text-xs text-slate-400">{config.subLabel}</p>
      </div>

      {/* Arrow for clickable tiles */}
      {config.href && (
        <ChevronRight
          className="h-4 w-4 shrink-0 self-center text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400"
          aria-hidden="true"
        />
      )}
    </div>
  );

  if (config.href) {
    return (
      <Link href={config.href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 rounded-xl">
        {inner}
      </Link>
    );
  }

  return inner;
}

// ─── Round tile ───────────────────────────────────────────────────────────────

function RoundTile({
  academicYear,
  closeDate,
  roundId,
}: {
  academicYear: string;
  closeDate: Date;
  roundId: string;
}) {
  const closeDateFormatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(closeDate);

  return (
    <Link
      href={`/rounds/${roundId}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 rounded-xl"
    >
      <div className="group flex items-start gap-4 rounded-xl border border-primary-900 bg-primary-900 p-6 shadow-sm transition-shadow hover:shadow-md cursor-pointer">
        {/* Icon */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-800"
          aria-hidden="true"
        >
          <CalendarRange className="h-5 w-5 text-accent-400" />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary-300">Active Round</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {academicYear}
          </p>
          <p className="mt-1 text-xs text-primary-300">
            Closes {closeDateFormatted}
          </p>
        </div>

        <ChevronRight
          className="h-4 w-4 shrink-0 self-center text-primary-500 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-300"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

// ─── No round empty state ─────────────────────────────────────────────────────

function NoRoundState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <CalendarRange className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-slate-700">
        No assessment rounds yet
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Create a round to start seeing dashboard data.
      </p>
      <Link
        href="/rounds"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-900"
      >
        Manage Rounds
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const activeRound = await getActiveRound();

  // If no rounds exist, show empty state
  if (!activeRound) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of the current assessment round.
          </p>
        </div>
        <NoRoundState />
      </div>
    );
  }

  const [counts, feed] = await Promise.all([
    getDashboardCounts(activeRound.id),
    getDashboardFeed(activeRound.id, 8),
  ]);

  // Build queue filter URLs
  const queueBase = "/queue";
  const queueWithRound = `${queueBase}?roundId=${activeRound.id}`;

  const TILES: Array<{ config: TileConfig; count: number }> = [
    {
      config: {
        label: "Awaiting Assessment",
        subLabel: "Submitted, not yet started",
        icon: ClipboardList,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        borderAccent: "border-amber-200",
        href: `${queueWithRound}&status=SUBMITTED`,
      },
      count: counts.awaitingAssessment,
    },
    {
      config: {
        label: "In Progress",
        subLabel: "Assessment paused",
        icon: Loader2,
        iconBg: "bg-orange-50",
        iconColor: "text-orange-600",
        borderAccent: "border-orange-200",
        href: `${queueWithRound}&status=PAUSED`,
      },
      count: counts.inProgress,
    },
    {
      config: {
        label: "Awaiting Recommendation",
        subLabel: "Assessment complete, no recommendation",
        icon: FileCheck2,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        borderAccent: "border-blue-200",
        href: `${queueWithRound}&status=COMPLETED`,
      },
      count: counts.awaitingRecommendation,
    },
    {
      config: {
        label: "Qualifies",
        subLabel: "Award recommended",
        icon: CheckCircle2,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        borderAccent: "border-emerald-200",
        href: `${queueWithRound}&status=QUALIFIES`,
      },
      count: counts.qualifies,
    },
    {
      config: {
        label: "Does Not Qualify",
        subLabel: "Ineligible for bursary",
        icon: XCircle,
        iconBg: "bg-slate-100",
        iconColor: "text-slate-500",
        borderAccent: "border-slate-200",
        href: `${queueWithRound}&status=DOES_NOT_QUALIFY`,
      },
      count: counts.doesNotQualify,
    },
  ];

  const totalAssessed =
    counts.qualifies + counts.doesNotQualify;
  const totalInRound =
    counts.awaitingAssessment +
    counts.inProgress +
    counts.awaitingRecommendation +
    counts.qualifies +
    counts.doesNotQualify;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of the {activeRound.academicYear} assessment round.
        </p>
      </div>

      {/* Summary tiles — 3x2 grid */}
      <section aria-label="Round summary statistics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((tile) => (
            <StatTile
              key={tile.config.label}
              config={tile.config}
              count={tile.count}
            />
          ))}

          {/* Active Round tile — navy, always last */}
          <RoundTile
            academicYear={activeRound.academicYear}
            closeDate={activeRound.closeDate}
            roundId={activeRound.id}
          />
        </div>
      </section>

      {/* Status distribution bar chart */}
      <section aria-label="Status distribution">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Status Distribution
            </h2>
            <span className="text-xs text-slate-400">
              {totalInRound} application{totalInRound !== 1 ? "s" : ""} in round
            </span>
          </div>

          {totalInRound === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-400">No applications yet</p>
            </div>
          ) : (
            <div className="space-y-2" role="list" aria-label="Application status counts">
              {[
                {
                  label: "Awaiting Assessment",
                  count: counts.awaitingAssessment,
                  colour: "bg-amber-400",
                  href: `${queueWithRound}&status=SUBMITTED`,
                },
                {
                  label: "In Progress",
                  count: counts.inProgress,
                  colour: "bg-orange-400",
                  href: `${queueWithRound}&status=PAUSED`,
                },
                {
                  label: "Awaiting Recommendation",
                  count: counts.awaitingRecommendation,
                  colour: "bg-blue-400",
                  href: `${queueWithRound}&status=COMPLETED`,
                },
                {
                  label: "Qualifies",
                  count: counts.qualifies,
                  colour: "bg-emerald-500",
                  href: `${queueWithRound}&status=QUALIFIES`,
                },
                {
                  label: "Does Not Qualify",
                  count: counts.doesNotQualify,
                  colour: "bg-slate-400",
                  href: `${queueWithRound}&status=DOES_NOT_QUALIFY`,
                },
              ].map((row) => {
                const pct =
                  totalInRound > 0
                    ? Math.round((row.count / totalInRound) * 100)
                    : 0;
                return (
                  <div key={row.label} role="listitem">
                    <Link
                      href={row.href}
                      className="group block rounded-lg px-1 py-0.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-600 group-hover:text-slate-800">
                          {row.label}
                        </span>
                        <span className="tabular-nums text-slate-500">
                          {row.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full transition-all", row.colour)}
                          style={{ width: `${pct}%` }}
                          aria-label={`${pct}%`}
                        />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {totalAssessed > 0 && (
            <p className="mt-4 text-xs text-slate-400">
              {totalAssessed} application{totalAssessed !== 1 ? "s" : ""} with
              final outcome
            </p>
          )}
        </div>
      </section>

      {/* Activity feed */}
      <section aria-label="Recent activity">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Recent Activity
          </h2>
          <ActivityFeed items={feed} />
        </div>
      </section>
    </div>
  );
}
