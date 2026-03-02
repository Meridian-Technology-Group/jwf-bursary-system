/**
 * History tab — WP-15
 *
 * Server component. Fetches and renders the complete audit log timeline for
 * this application, sorted newest-first. Each entry shows:
 *   - Relative / absolute timestamp
 *   - Action code (human-readable label where known)
 *   - User who performed the action (first + last name, or email fallback)
 *   - Context string
 *   - Metadata JSON (collapsed by default — future enhancement)
 *
 * Uses getAuditLogsForEntity from src/lib/db/queries/audit.ts.
 */

import { notFound } from "next/navigation";
import { requireRole, Role } from "@/lib/auth/roles";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAuditLogsForEntity } from "@/lib/db/queries/audit";
import type { AuditLogWithUser } from "@/lib/db/queries/audit";
import { ClockIcon, UserIcon } from "lucide-react";

export const metadata = {
  title: "History",
};

// ─── Action label map ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  APPLICATION_STATUS_CHANGED: "Status changed",
  APPLICATION_PAUSED: "Application paused",
  APPLICATION_RESUMED: "Application resumed",
  APPLICATION_OUTCOME_SET: "Outcome set",
  DOCUMENT_UPLOADED_BY_ASSESSOR: "Document uploaded by assessor",
  DOCUMENT_VERIFIED: "Document verified",
  DOCUMENT_UNVERIFIED: "Document unverified",
  "assessment.begin": "Assessment begun",
  "assessment.save": "Assessment saved",
  "assessment.complete": "Assessment completed",
  "assessment.pause": "Assessment paused",
};

function humaniseAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

// ─── Status colour map ────────────────────────────────────────────────────────

function actionColour(action: string): string {
  if (action.includes("PAUSED") || action.includes("pause")) {
    return "bg-yellow-400";
  }
  if (
    action.includes("OUTCOME") ||
    action.includes("QUALIFIES") ||
    action.includes("complete")
  ) {
    return "bg-green-500";
  }
  if (action.includes("RESUMED") || action.includes("begin")) {
    return "bg-blue-500";
  }
  if (action.includes("DOCUMENT")) {
    return "bg-purple-500";
  }
  if (action.includes("STATUS")) {
    return "bg-primary-600";
  }
  return "bg-slate-400";
}

// ─── Timestamp formatting ─────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTimestamp(date);
}

// ─── User display name ────────────────────────────────────────────────────────

function displayName(
  user: AuditLogWithUser["user"]
): string {
  if (!user) return "System";
  const name =
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email;
}

// ─── Timeline entry ───────────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  isLast,
}: {
  entry: AuditLogWithUser;
  isLast: boolean;
}) {
  const dotColour = actionColour(entry.action);

  return (
    <div className="relative flex gap-4">
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200"
          aria-hidden="true"
        />
      )}

      {/* Status dot */}
      <div className="relative z-10 mt-1 shrink-0">
        <span
          className={`block h-5 w-5 rounded-full border-2 border-white shadow-sm ${dotColour}`}
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-slate-800 capitalize">
            {humaniseAction(entry.action)}
          </p>
          <time
            dateTime={entry.createdAt.toISOString()}
            title={formatTimestamp(entry.createdAt)}
            className="shrink-0 text-xs text-slate-400 tabular-nums"
          >
            {relativeTime(entry.createdAt)}
          </time>
        </div>

        {entry.context && (
          <p className="mt-0.5 text-sm text-slate-600">{entry.context}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          {/* User */}
          <span className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" aria-hidden="true" />
            {displayName(entry.user)}
          </span>
          {/* Full timestamp */}
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3 w-3" aria-hidden="true" />
            {formatTimestamp(entry.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default async function HistoryPage({ params }: Props) {
  await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const application = await getApplicationWithDetails(params.id);
  if (!application) {
    notFound();
  }

  // Fetch audit logs for this application entity — reverse to newest-first
  const logs = await getAuditLogsForEntity("Application", params.id);
  const reversedLogs = [...logs].reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Audit Timeline
          </h2>
          <span className="text-xs text-slate-400">
            {reversedLogs.length} event{reversedLogs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {reversedLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center">
            <p className="text-sm text-slate-400">
              No history recorded for this application yet.
            </p>
          </div>
        ) : (
          <div className="pl-1">
            {reversedLogs.map((entry, index) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                isLast={index === reversedLogs.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
