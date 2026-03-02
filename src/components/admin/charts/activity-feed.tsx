/**
 * Activity feed component for the admin dashboard.
 *
 * Displays recent workflow events with a coloured status dot, application
 * reference, event description, relative time, and assessor name.
 * Includes a "View full audit trail" link at the bottom.
 *
 * This is a Server Component — it receives pre-fetched data as props.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { DashboardFeedItem } from "@/lib/db/queries/reports";

// ─── Action display helpers ───────────────────────────────────────────────────

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    APPLICATION_SUBMITTED: "Application submitted",
    ASSESSMENT_STARTED: "Assessment started",
    ASSESSMENT_PAUSED: "Assessment paused",
    ASSESSMENT_COMPLETED: "Assessment completed",
    RECOMMENDATION_SAVED: "Recommendation saved",
    OUTCOME_DECIDED: "Outcome decided",
    APPLICATION_STATUS_CHANGED: "Status updated",
  };
  return map[action] ?? action.replace(/_/g, " ").toLowerCase();
}

function dotColour(action: string): string {
  if (action === "APPLICATION_SUBMITTED") return "bg-blue-500";
  if (action === "ASSESSMENT_STARTED") return "bg-emerald-500";
  if (action === "ASSESSMENT_PAUSED") return "bg-amber-500";
  if (action === "ASSESSMENT_COMPLETED") return "bg-teal-500";
  if (action === "RECOMMENDATION_SAVED") return "bg-violet-500";
  if (action === "OUTCOME_DECIDED") return "bg-emerald-600";
  return "bg-slate-400";
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

// ─── Single feed item ─────────────────────────────────────────────────────────

function FeedItem({ item, isLast }: { item: DashboardFeedItem; isLast: boolean }) {
  return (
    <div className={`relative flex gap-3 ${isLast ? "" : "pb-4"}`}>
      {/* Vertical connector */}
      {!isLast && (
        <div
          className="absolute left-[8px] top-5 bottom-0 w-px bg-slate-100"
          aria-hidden="true"
        />
      )}

      {/* Status dot */}
      <div className="relative z-10 mt-1.5 shrink-0">
        <span
          className={`block h-4 w-4 rounded-full border-2 border-white shadow-sm ${dotColour(item.action)}`}
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm text-slate-800">
            {item.applicationReference && (
              <Link
                href={`/applications/${item.entityId}`}
                className="font-medium text-primary-900 hover:underline"
              >
                {item.applicationReference}
              </Link>
            )}
            {item.applicationReference && " — "}
            <span className="text-slate-600">{actionLabel(item.action)}</span>
            {item.childName && (
              <span className="text-slate-500"> ({item.childName})</span>
            )}
          </p>
          <time
            dateTime={item.createdAt.toISOString()}
            className="shrink-0 text-xs text-slate-400 tabular-nums"
          >
            {relativeTime(item.createdAt)}
          </time>
        </div>

        {item.userName && (
          <p className="mt-0.5 text-xs text-slate-400">by {item.userName}</p>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  items: DashboardFeedItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center">
        <p className="text-sm text-slate-400">No recent activity for this round.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-slate-50 pl-1">
        {items.map((item, index) => (
          <div key={item.id} className={index > 0 ? "pt-4" : ""}>
            <FeedItem item={item} isLast={index === items.length - 1} />
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <Link
          href="/audit"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-900 hover:underline"
        >
          View full audit trail
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
