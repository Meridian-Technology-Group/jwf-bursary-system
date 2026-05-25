/**
 * ExportReadinessPanel — per-school export readiness for the Round Cockpit (#18).
 *
 * One row per school that has decided recommendations: the school name, the
 * decided count, when it was last exported (or "Not yet exported"), and a
 * download button linking to the XLSX export endpoint scoped to that school.
 * A green check marks a school whose latest decision is already covered by an
 * export (`allExported`), mirroring the watchlist's READY_NOT_EXPORTED rule.
 *
 * Pure presentational Server Component. The download links are plain anchors
 * (the endpoint streams a file, not an in-app navigation), with `download` so
 * the browser saves rather than navigates.
 */

import { CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import type { ExportReadiness } from "@/lib/db/queries/round-cockpit";

interface ExportReadinessPanelProps {
  exportReadiness: ExportReadiness[];
  roundId: string;
}

const SCHOOL_LABELS: Record<string, string> = {
  TRINITY: "Trinity",
  WHITGIFT: "Whitgift",
};

function formatExportDate(date: Date | null): string {
  if (!date) return "Not yet exported";
  return `Last exported ${new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

export function ExportReadinessPanel({
  exportReadiness,
  roundId,
}: ExportReadinessPanelProps) {
  return (
    <section
      aria-labelledby="export-readiness-heading"
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <FileSpreadsheet
          className="h-4 w-4 text-slate-400"
          aria-hidden="true"
        />
        <h2
          id="export-readiness-heading"
          className="text-base font-medium text-primary-900"
        >
          Export Readiness
        </h2>
      </div>

      {exportReadiness.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          Nothing decided yet — exports become available once recommendations
          are finalised.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {exportReadiness.map((row) => {
            const schoolLabel = SCHOOL_LABELS[row.school] ?? row.school;
            const href = `/api/exports/recommendations?roundId=${encodeURIComponent(
              roundId,
            )}&school=${encodeURIComponent(row.school)}&format=xlsx`;

            return (
              <li
                key={row.school}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5"
              >
                {/* School + readiness state */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {row.allExported ? (
                    <CheckCircle2
                      className="h-5 w-5 shrink-0 text-emerald-600"
                      aria-label="All decisions exported"
                    />
                  ) : (
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-amber-400"
                      aria-label="Pending export"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {schoolLabel}
                    </p>
                    <p className="text-xs text-slate-400">
                      <span className="tabular-nums">{row.decided}</span>{" "}
                      decided
                      <span className="mx-1.5 text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      {formatExportDate(row.lastExportedAt)}
                    </p>
                  </div>
                </div>

                {/* Download button */}
                <a
                  href={href}
                  download
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-primary-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export XLSX
                  <span className="sr-only">for {schoolLabel}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
