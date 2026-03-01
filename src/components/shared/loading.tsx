/**
 * Loading state components.
 *
 * PageLoader    — full-page centered spinner
 * SectionLoader — skeleton for a form section (5 rows)
 * TableSkeleton — skeleton for a data table
 */

import { cn } from "@/lib/utils";

// ─── Spinner primitive ────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin text-primary-900", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── PageLoader ───────────────────────────────────────────────────────────────

/**
 * Full-page centered spinner. Use as a Suspense fallback or route loading state.
 */
export function PageLoader() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-label="Loading page"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-10 w-10" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

// ─── SectionLoader ────────────────────────────────────────────────────────────

/**
 * Skeleton loader mimicking a form section (label + input, repeated).
 */
export function SectionLoader() {
  return (
    <div
      className="space-y-6 rounded-lg border border-border bg-white p-6"
      role="status"
      aria-label="Loading section"
    >
      {/* Section heading skeleton */}
      <div className="h-6 w-48 skeleton" />

      {/* 5 field-row skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-4 w-32 skeleton" />
          <div className="h-10 w-full skeleton" />
        </div>
      ))}

      <span className="sr-only">Loading content, please wait</span>
    </div>
  );
}

// ─── TableSkeleton ────────────────────────────────────────────────────────────

interface TableSkeletonProps {
  /** Number of data rows to render (default: 5) */
  rows?: number;
  /** Number of columns (default: 4) */
  columns?: number;
}

/**
 * Skeleton loader for a data table. Shows a header row plus configurable data rows.
 */
export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-white"
      role="status"
      aria-label="Loading table"
    >
      {/* Table header */}
      <div className="border-b border-border bg-slate-50 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className={cn("h-4 skeleton", i === 0 ? "w-32" : "flex-1")}
            />
          ))}
        </div>
      </div>

      {/* Data rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div
                key={colIdx}
                className={cn(
                  "h-4 skeleton",
                  colIdx === 0 ? "w-40" : "flex-1",
                  // Vary widths for visual realism
                  colIdx === columns - 1 ? "w-20" : ""
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <span className="sr-only">Loading table data, please wait</span>
    </div>
  );
}
