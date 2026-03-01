"use client";

/**
 * YearComparison — side-by-side year-on-year comparison panel.
 *
 * Displays previous-year assessment figures alongside the current year's
 * live values for the assessor. Previous values are shown in muted
 * non-editable text; current values reference the live assessment form.
 *
 * Colour coding:
 *   - Green (success-600) = improved position (income lower, fees lower, etc.)
 *   - Red   (error-600)   = deteriorated position
 *   - Neutral             = no change or indeterminate
 */

import * as React from "react";
import { TrendingDown, TrendingUp, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviousAssessmentSnapshot } from "@/lib/db/queries/reassessment";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurrentYearFigures {
  /** Total household net income (£) */
  totalHouseholdNetIncome?: number | null;
  /** Net assets yearly valuation (£) */
  netAssetsYearlyValuation?: number | null;
  /** HNDI after notional substitute (£) */
  hndiAfterNs?: number | null;
  /** Required bursary (£) */
  requiredBursary?: number | null;
  /** Gross fees (£) */
  grossFees?: number | null;
  /** Bursary award (£) */
  bursaryAward?: number | null;
  /** Yearly payable fees (£) */
  yearlyPayableFees?: number | null;
  /** Monthly payable fees (£) */
  monthlyPayableFees?: number | null;
}

export interface YearComparisonProps {
  /** Previous year's assessment snapshot (from getPreviousAssessment). */
  previous: PreviousAssessmentSnapshot | null;
  /** Current year's live figures from the assessment form. */
  current: CurrentYearFigures;
  /** Academic year label for the current round, e.g. "2025–26". */
  currentAcademicYear: string;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDecimal(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

function formatGBP(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type Direction = "better" | "worse" | "neutral";

/**
 * Determines change direction.
 *
 * @param previous  Previous year value
 * @param current   Current year value
 * @param lowerIsBetter  When true, a decrease is "better" (e.g. income, fees).
 */
function getDirection(
  previous: number | null,
  current: number | null | undefined,
  lowerIsBetter: boolean
): Direction {
  if (previous == null || current == null) return "neutral";
  if (current < previous) return lowerIsBetter ? "better" : "worse";
  if (current > previous) return lowerIsBetter ? "worse" : "better";
  return "neutral";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DirectionIcon({ direction }: { direction: Direction }) {
  switch (direction) {
    case "better":
      return (
        <TrendingDown
          className="h-3.5 w-3.5 text-success-600"
          aria-label="Improved"
        />
      );
    case "worse":
      return (
        <TrendingUp
          className="h-3.5 w-3.5 text-error-600"
          aria-label="Deteriorated"
        />
      );
    default:
      return (
        <Minus
          className="h-3.5 w-3.5 text-slate-400"
          aria-label="No change"
        />
      );
  }
}

interface ComparisonRowProps {
  label: string;
  previousValue: number | null;
  currentValue: number | null | undefined;
  direction: Direction;
}

function ComparisonRow({
  label,
  previousValue,
  currentValue,
  direction,
}: ComparisonRowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5 pr-4 text-sm text-slate-600">{label}</td>

      {/* Previous year value — muted, non-editable */}
      <td className="py-2.5 pr-4 text-right font-mono text-sm text-slate-400 tabular-nums">
        {formatGBP(previousValue)}
      </td>

      {/* Current year value — emphasised */}
      <td
        className={cn(
          "py-2.5 text-right font-mono text-sm tabular-nums font-medium",
          direction === "better" && "text-success-600",
          direction === "worse" && "text-error-600",
          direction === "neutral" && "text-slate-800"
        )}
      >
        {formatGBP(currentValue)}
      </td>

      {/* Trend icon */}
      <td className="py-2.5 pl-2 text-center">
        <DirectionIcon direction={direction} />
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * YearComparison panel for the admin assessment form.
 *
 * Renders a two-column table: "Previous Year" | "Current Year".
 * Differences are highlighted with green (improved) / red (worse) colouring.
 */
export function YearComparison({
  previous,
  current,
  currentAcademicYear,
  className,
}: YearComparisonProps) {
  if (!previous) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3",
          className
        )}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-sm text-slate-500">
          No previous year assessment data available for comparison.
        </p>
      </div>
    );
  }

  const prevIncome = parseDecimal(previous.totalHouseholdNetIncome);
  const prevAssets = parseDecimal(previous.netAssetsYearlyValuation);
  const prevHndi = parseDecimal(previous.hndiAfterNs);
  const prevBursary = parseDecimal(previous.requiredBursary);
  const prevGrossFees = parseDecimal(previous.grossFees);
  const prevAward = parseDecimal(previous.bursaryAward);
  const prevYearly = parseDecimal(previous.yearlyPayableFees);
  const prevMonthly = parseDecimal(previous.monthlyPayableFees);

  const rows: Array<{
    label: string;
    prevValue: number | null;
    currValue: number | null | undefined;
    lowerIsBetter: boolean;
  }> = [
    {
      label: "Total household net income",
      prevValue: prevIncome,
      currValue: current.totalHouseholdNetIncome,
      lowerIsBetter: true,
    },
    {
      label: "Net assets yearly valuation",
      prevValue: prevAssets,
      currValue: current.netAssetsYearlyValuation,
      lowerIsBetter: true,
    },
    {
      label: "HNDI after notional substitute",
      prevValue: prevHndi,
      currValue: current.hndiAfterNs,
      lowerIsBetter: true,
    },
    {
      label: "Required bursary",
      prevValue: prevBursary,
      currValue: current.requiredBursary,
      lowerIsBetter: false,
    },
    {
      label: "Gross fees",
      prevValue: prevGrossFees,
      currValue: current.grossFees,
      lowerIsBetter: true,
    },
    {
      label: "Bursary award",
      prevValue: prevAward,
      currValue: current.bursaryAward,
      lowerIsBetter: false,
    },
    {
      label: "Yearly payable fees",
      prevValue: prevYearly,
      currValue: current.yearlyPayableFees,
      lowerIsBetter: true,
    },
    {
      label: "Monthly payable fees",
      prevValue: prevMonthly,
      currValue: current.monthlyPayableFees,
      lowerIsBetter: true,
    },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200 bg-white",
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">
          Year-on-Year Comparison
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Previous application: {previous.applicationReference} ({previous.academicYear})
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                Item
              </th>
              <th className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                {previous.academicYear}
              </th>
              <th className="py-2 text-right text-xs font-medium uppercase tracking-wider text-slate-700">
                {currentAcademicYear}
              </th>
              <th className="py-2 pl-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                <span className="sr-only">Trend</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 px-4">
            {rows.map((row) => (
              <ComparisonRow
                key={row.label}
                label={row.label}
                previousValue={row.prevValue}
                currentValue={row.currValue}
                direction={getDirection(
                  row.prevValue,
                  row.currValue ?? null,
                  row.lowerIsBetter
                )}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Schooling years remaining comparison */}
      {previous.schoolingYearsRemaining !== null && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Schooling years remaining (previous)
            </span>
            <span className="font-mono font-medium text-slate-700">
              {previous.schoolingYearsRemaining}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-success-600" />
            Improved
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-error-600" />
            Deteriorated
          </span>
          <span className="flex items-center gap-1">
            <Minus className="h-3 w-3" />
            Unchanged
          </span>
        </div>
      </div>
    </div>
  );
}
