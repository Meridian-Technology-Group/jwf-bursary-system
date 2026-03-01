"use client";

/**
 * BenchmarkDisplay — first-year payable fees benchmark banner.
 *
 * Shows the first-year payable fees from BursaryAccount.benchmarkPayableFees
 * as an informational banner in the assessment form. If the current payable
 * fees are below the benchmark, an advisory note is shown.
 *
 * The benchmark acts as a floor: the assessor is alerted when the current
 * year's fees would drop below the level established in year one.
 */

import * as React from "react";
import { Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BenchmarkDisplayProps {
  /**
   * The first-year payable fees benchmark from BursaryAccount.benchmarkPayableFees.
   * Pass null or undefined if no benchmark has been set yet.
   */
  benchmarkPayableFees: number | string | null | undefined;
  /**
   * The current year's calculated yearly payable fees from the assessment form.
   * Pass null or undefined if not yet calculated.
   */
  currentYearlyPayableFees?: number | null;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Informational banner displaying the first-year benchmark payable fees.
 *
 * If currentYearlyPayableFees is provided and falls below the benchmark,
 * an advisory warning is added inside the banner.
 */
export function BenchmarkDisplay({
  benchmarkPayableFees,
  currentYearlyPayableFees,
  className,
}: BenchmarkDisplayProps) {
  // Parse benchmark to a number
  const benchmark =
    benchmarkPayableFees == null
      ? null
      : typeof benchmarkPayableFees === "number"
        ? benchmarkPayableFees
        : parseFloat(String(benchmarkPayableFees));

  if (benchmark == null || isNaN(benchmark)) {
    // No benchmark set — render nothing
    return null;
  }

  const isBelowBenchmark =
    currentYearlyPayableFees != null && currentYearlyPayableFees < benchmark;

  return (
    <div
      role="note"
      aria-label="First-year benchmark"
      className={cn(
        "rounded-lg border px-4 py-3",
        isBelowBenchmark
          ? "border-warning-200 bg-warning-50"
          : "border-info-200 bg-info-50",
        className
      )}
    >
      {/* Primary benchmark line */}
      <div className="flex items-start gap-3">
        <Info
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            isBelowBenchmark ? "text-warning-600" : "text-info-600"
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              isBelowBenchmark ? "text-primary-900" : "text-primary-900"
            )}
          >
            First year benchmark:{" "}
            <span className="font-mono tabular-nums">
              {formatGBP(benchmark)}/year
            </span>
          </p>
          <p
            className={cn(
              "mt-0.5 text-xs",
              isBelowBenchmark ? "text-warning-600" : "text-info-600"
            )}
          >
            This is the payable fees figure established in the first year of
            the bursary. It serves as a reference floor for re-assessments.
          </p>
        </div>
      </div>

      {/* Advisory when current fees are below benchmark */}
      {isBelowBenchmark && currentYearlyPayableFees != null && (
        <div className="mt-3 flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2.5">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-warning-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-primary-900">
              Below first year level
            </p>
            <p className="mt-0.5 text-xs text-warning-600">
              Current yearly payable fees (
              <span className="font-mono tabular-nums">
                {formatGBP(currentYearlyPayableFees)}
              </span>
              ) are{" "}
              <span className="font-mono tabular-nums">
                {formatGBP(benchmark - currentYearlyPayableFees)}
              </span>{" "}
              below the first year benchmark. Review before finalising the
              assessment.
            </p>
          </div>
        </div>
      )}

      {/* Current vs benchmark comparison line when above/equal */}
      {!isBelowBenchmark && currentYearlyPayableFees != null && (
        <div className="mt-2 ml-7">
          <p className="text-xs text-info-600">
            Current year:{" "}
            <span className="font-mono tabular-nums font-medium text-info-700">
              {formatGBP(currentYearlyPayableFees)}/year
            </span>
            {currentYearlyPayableFees > benchmark && (
              <span className="ml-1 text-slate-500">
                ({formatGBP(currentYearlyPayableFees - benchmark)} above
                benchmark)
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
