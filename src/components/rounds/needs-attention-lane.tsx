/**
 * NeedsAttentionLane — the watchlist "lane" for the Round Cockpit (#18).
 *
 * Presentational Server Component. Receives the already-ranked, already-deduped
 * `WatchlistRule[]` (blockers first, then warnings; zero-count rules dropped)
 * and renders one row per rule with a severity icon, count, plain-English label,
 * and a drill-in link. An empty `rules` array renders a calm "all clear" state.
 *
 * No `"use client"`, no hooks — just `next/link` + lucide icons so it can stream
 * with the rest of the round detail page.
 */

import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import type { WatchlistRule } from "@/lib/db/queries/round-watchlist";
import { cn } from "@/lib/utils";

interface NeedsAttentionLaneProps {
  rules: WatchlistRule[];
}

// ─── Severity styling ──────────────────────────────────────────────────────────

const severityStyles = {
  blocker: {
    icon: AlertOctagon,
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
    countColor: "text-red-700",
    rowHover: "hover:bg-red-50/60",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    countColor: "text-amber-700",
    rowHover: "hover:bg-amber-50/60",
  },
} as const;

// ─── Single rule row ─────────────────────────────────────────────────────────────

function RuleRow({ rule }: { rule: WatchlistRule }) {
  const style = severityStyles[rule.severity];
  const Icon = style.icon;

  return (
    <Link
      href={rule.drillHref}
      className={cn(
        "group flex items-center gap-4 px-5 py-3.5 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset",
        style.rowHover,
      )}
    >
      {/* Severity icon */}
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          style.iconBg,
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-5 w-5", style.iconColor)} />
      </span>

      {/* Count */}
      <span
        className={cn(
          "w-8 shrink-0 text-2xl font-semibold tabular-nums",
          style.countColor,
        )}
      >
        {rule.count}
      </span>

      {/* Label */}
      <span className="min-w-0 flex-1 text-sm text-slate-700">
        <span className="sr-only">
          {rule.severity === "blocker" ? "Blocker: " : "Warning: "}
        </span>
        {rule.label}
      </span>

      {/* Drill-in affordance */}
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary-700 group-hover:text-primary-900 group-hover:underline">
        View
        <ChevronRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NeedsAttentionLane({ rules }: NeedsAttentionLaneProps) {
  const headingId = "needs-attention-heading";

  // Empty / all-clear state — calm success styling, not an error.
  if (rules.length === 0) {
    return (
      <section
        aria-labelledby={headingId}
        className="rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <h2 id={headingId} className="sr-only">
          Needs Attention
        </h2>
        <div className="flex items-center gap-3 px-5 py-5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50"
            aria-hidden="true"
          >
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </span>
          <p className="text-sm font-medium text-slate-700">
            All clear — nothing needs your attention.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2
          id={headingId}
          className="text-base font-medium text-primary-900"
        >
          Needs Attention
        </h2>
        <span
          className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md bg-slate-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-slate-700"
          aria-label={`${rules.length} ${rules.length === 1 ? "item" : "items"} needing attention`}
        >
          {rules.length}
        </span>
      </div>

      {/* Rule rows */}
      <ul className="divide-y divide-slate-100">
        {rules.map((rule) => (
          <li key={rule.id}>
            <RuleRow rule={rule} />
          </li>
        ))}
      </ul>
    </section>
  );
}
