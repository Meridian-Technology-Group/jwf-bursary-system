/**
 * RoundLedgerRow — a compact reverse-chronological row for a past (CLOSED) round
 * on the Season Ledger (`/rounds`, Round Cockpit #18, Stage E).
 *
 * Pure presentational Server Component — no hooks, no `"use client"`. Surfaces
 * the academic year (linking into `/rounds/{id}`), the open→close date range,
 * total applications, decided count, and the qualification rate (guarded
 * against divide-by-zero), with a muted status badge.
 */

import Link from "next/link";
import { RoundStatusBadge } from "@/components/admin/round-status-badge";

export interface RoundLedgerRowProps {
  id: string;
  academicYear: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  openDate: Date;
  closeDate: Date;
  total: number;
  qualifies: number;
  doesNotQualify: number;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RoundLedgerRow({
  id,
  academicYear,
  status,
  openDate,
  closeDate,
  total,
  qualifies,
  doesNotQualify,
}: RoundLedgerRowProps) {
  const decided = qualifies + doesNotQualify;
  const qualifyPct = decided > 0 ? Math.round((qualifies / decided) * 100) : null;

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 transition-colors hover:bg-slate-50">
      {/* Year + status */}
      <div className="flex min-w-[10rem] items-center gap-2">
        <Link
          href={`/rounds/${id}`}
          className="text-sm font-semibold text-primary-700 hover:text-primary-900 hover:underline"
        >
          {academicYear}
        </Link>
        <RoundStatusBadge status={status} />
      </div>

      {/* Date range */}
      <span className="text-xs text-slate-500 tabular-nums">
        {formatDate(openDate)} – {formatDate(closeDate)}
      </span>

      {/* Spacer pushes metrics to the right on wide rows */}
      <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-slate-500">
          <span className="font-semibold tabular-nums text-primary-900">
            {total}
          </span>{" "}
          applications
        </span>
        <span className="text-slate-500">
          <span className="font-semibold tabular-nums text-primary-900">
            {decided}
          </span>{" "}
          decided
        </span>
        <span className="text-slate-500">
          {qualifyPct !== null ? (
            <>
              <span className="font-semibold tabular-nums text-primary-900">
                {qualifyPct}%
              </span>{" "}
              qualified
            </>
          ) : (
            <span className="text-slate-400">No decisions</span>
          )}
        </span>
      </div>
    </li>
  );
}
