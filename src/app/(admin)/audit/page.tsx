/**
 * Audit Log page — WP-20
 *
 * Server component. Renders a filterable, paginated view of all audit log
 * entries across the system. Filters are applied via GET query parameters
 * so they are bookmarkable and shareable.
 *
 * Filters supported:
 *   entityType  — e.g. "Application", "Document"
 *   action      — free-text substring match (case-insensitive)
 *   startDate   — inclusive lower bound (YYYY-MM-DD)
 *   endDate     — inclusive upper bound (YYYY-MM-DD)
 *   page        — 1-based page index (defaults to 1)
 */

import type { Metadata } from "next";
import { requireRole, Role } from "@/lib/auth/roles";
import {
  getFilteredAuditLogs,
  countFilteredAuditLogs,
} from "@/lib/db/queries/audit";
import type { AuditLogWithUser } from "@/lib/db/queries/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClockIcon, UserIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Audit Log",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const ENTITY_TYPES = [
  { value: "", label: "All entity types" },
  { value: "Application", label: "Application" },
  { value: "Document", label: "Document" },
  { value: "Assessment", label: "Assessment" },
  { value: "Invitation", label: "Invitation" },
];

// ─── Timestamp helpers ────────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

function displayName(user: AuditLogWithUser["user"]): string {
  if (!user) return "System";
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email;
}

// ─── Action colour ────────────────────────────────────────────────────────────

function actionColour(action: string): string {
  if (action.includes("PAUSED") || action.includes("pause")) {
    return "bg-yellow-400";
  }
  if (
    action.includes("OUTCOME") ||
    action.includes("QUALIFIES") ||
    action.includes("complete") ||
    action.includes("SUBMITTED")
  ) {
    return "bg-green-500";
  }
  if (action.includes("RESUMED") || action.includes("begin")) {
    return "bg-blue-500";
  }
  if (action.includes("DOCUMENT") || action.includes("document")) {
    return "bg-purple-500";
  }
  if (action.includes("STATUS") || action.includes("DELETED")) {
    return "bg-red-400";
  }
  if (action.includes("REVEAL") || action.includes("VERIFY")) {
    return "bg-orange-400";
  }
  return "bg-slate-400";
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
  const details =
    entry.metadata && typeof entry.metadata === "object"
      ? JSON.stringify(entry.metadata, null, 2)
      : null;

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
        {/* Action + relative timestamp */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-sm font-semibold text-slate-800">
            {entry.action}
          </p>
          <time
            dateTime={entry.createdAt.toISOString()}
            title={formatTimestamp(entry.createdAt)}
            className="shrink-0 text-xs text-slate-400 tabular-nums"
          >
            {relativeTime(entry.createdAt)}
          </time>
        </div>

        {/* Context string */}
        {entry.context && (
          <p className="mt-0.5 text-sm text-slate-600">{entry.context}</p>
        )}

        {/* Meta row: user, entity, full timestamp */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" aria-hidden="true" />
            {displayName(entry.user)}
          </span>

          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
            {entry.entityType}
            {entry.entityId ? ` / ${entry.entityId.slice(0, 8)}…` : ""}
          </span>

          <span className="flex items-center gap-1">
            <ClockIcon className="h-3 w-3" aria-hidden="true" />
            {formatTimestamp(entry.createdAt)}
          </span>
        </div>

        {/* Metadata JSON (collapsed visually via small pre block) */}
        {details && details !== "{}" && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
              Show metadata
            </summary>
            <pre className="mt-1 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">
              {details}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// ─── Filter form ──────────────────────────────────────────────────────────────

function FilterBar({
  entityType,
  action,
  startDate,
  endDate,
}: {
  entityType: string;
  action: string;
  startDate: string;
  endDate: string;
}) {
  return (
    <form method="GET" className="flex flex-wrap items-end gap-3">
      {/* Entity type select */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="entityType"
          className="text-xs font-medium text-slate-600"
        >
          Entity type
        </label>
        <select
          id="entityType"
          name="entityType"
          defaultValue={entityType}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-accent-600"
        >
          {ENTITY_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Action filter */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="action"
          className="text-xs font-medium text-slate-600"
        >
          Action
        </label>
        <Input
          id="action"
          name="action"
          placeholder="e.g. SUBMITTED"
          defaultValue={action}
          className="h-9 w-48 text-sm"
        />
      </div>

      {/* Start date */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="startDate"
          className="text-xs font-medium text-slate-600"
        >
          From
        </label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={startDate}
          className="h-9 text-sm"
        />
      </div>

      {/* End date */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="endDate"
          className="text-xs font-medium text-slate-600"
        >
          To
        </label>
        <Input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={endDate}
          className="h-9 text-sm"
        />
      </div>

      <Button type="submit" size="sm" className="h-9">
        Filter
      </Button>

      {/* Clear filters */}
      {(entityType || action || startDate || endDate) && (
        <a
          href="/audit"
          className="inline-flex h-9 items-center rounded-md px-3 text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
        >
          Clear
        </a>
      )}
    </form>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string>;
}) {
  function buildUrl(targetPage: number): string {
    const params = new URLSearchParams({
      ...searchParams,
      page: String(targetPage),
    });
    return `/audit?${params.toString()}`;
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <a
            href={buildUrl(page - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-sm hover:bg-slate-50"
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </a>
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-300">
            <ChevronLeftIcon className="h-4 w-4" />
          </span>
        )}

        {page < totalPages ? (
          <a
            href={buildUrl(page + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-sm hover:bg-slate-50"
            aria-label="Next page"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </a>
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-300">
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  // Resolve search params
  const sp = await searchParams;
  const entityType = typeof sp.entityType === "string" ? sp.entityType : "";
  const action = typeof sp.action === "string" ? sp.action : "";
  const startDate = typeof sp.startDate === "string" ? sp.startDate : "";
  const endDate = typeof sp.endDate === "string" ? sp.endDate : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const filters = {
    entityType: entityType || undefined,
    action: action || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const [logs, totalCount] = await Promise.all([
    getFilteredAuditLogs(filters),
    countFilteredAuditLogs({
      entityType: filters.entityType,
      action: filters.action,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Build searchParams record for pagination URL construction
  const searchParamsRecord: Record<string, string> = {};
  if (entityType) searchParamsRecord.entityType = entityType;
  if (action) searchParamsRecord.action = action;
  if (startDate) searchParamsRecord.startDate = startDate;
  if (endDate) searchParamsRecord.endDate = endDate;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          System-wide activity log. All entries are immutable and append-only.
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <FilterBar
          entityType={entityType}
          action={action}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* Results */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Audit Timeline
          </h2>
          <span className="text-xs text-slate-400">
            {totalCount.toLocaleString()} event{totalCount !== 1 ? "s" : ""} total
            {totalPages > 1 && ` — showing page ${page} of ${totalPages}`}
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center">
            <p className="text-sm text-slate-400">
              No audit log entries match the selected filters.
            </p>
          </div>
        ) : (
          <div className="pl-1">
            {logs.map((entry, index) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                isLast={index === logs.length - 1}
              />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          searchParams={searchParamsRecord}
        />
      </div>
    </div>
  );
}
