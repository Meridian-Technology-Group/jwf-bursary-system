"use client";

/**
 * ProgressBar — shows "X of 10 sections complete" with a linear progress bar.
 */

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  completedSections: number;
  totalSections: number;
  className?: string;
}

export function ProgressBar({
  completedSections,
  totalSections,
  className,
}: ProgressBarProps) {
  const pct =
    totalSections > 0
      ? Math.round((completedSections / totalSections) * 100)
      : 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {completedSections} of {totalSections} sections complete
        </span>
        <span className="font-medium text-primary-700">{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completedSections} of ${totalSections} sections complete`}
      >
        <div
          className="h-full rounded-full bg-accent-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
