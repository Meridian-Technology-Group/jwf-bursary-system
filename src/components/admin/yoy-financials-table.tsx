/**
 * CALC-10 — YoY financials history table (workbook §3.16 /
 * gap-analysis.md §2.2 rows 195–203). Server component: pure display over
 * `buildYoyFinancialsTable`'s output (`src/lib/assessment/yoy-financials.ts`).
 * Read-only projection — no write path lives here.
 *
 * Null-safe: v1 assessment rows have no property-equity / debt-exposure /
 * squeeze-label figures (those are v2-only snapshot columns), so those cells
 * render "n/a" rather than a misleading £0 or blank.
 */

import { cn } from "@/lib/utils";
import type { YoyFinancialsTableRow } from "@/lib/assessment/yoy-financials";

export interface YoyFinancialsTableProps {
  rows: YoyFinancialsTableRow[];
  className?: string;
}

function formatGBP(value: number | null): string {
  if (value == null) return "n/a";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDelta(value: number | null): { text: string; className: string } {
  if (value == null) return { text: "n/a", className: "text-slate-300" };
  if (value === 0) return { text: "—", className: "text-slate-400" };
  const sign = value > 0 ? "+" : "−";
  const text = `${sign}${formatGBP(Math.abs(value))}`;
  return { text, className: value > 0 ? "text-red-600" : "text-emerald-600" };
}

export function YoyFinancialsTable({ rows, className }: YoyFinancialsTableProps) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400",
          className
        )}
      >
        No completed assessments yet for this account — the year-on-year
        financials history will populate once one is completed.
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-slate-200", className)}>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              Academic year
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
              Household net income
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
              Cash + savings
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
              Property equity
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
              Yearly debt exposure
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              Lifestyle squeeze
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const incomeDelta = formatDelta(row.deltaTotalHouseholdNetIncome);
            const cashDelta = formatDelta(row.deltaTotalCashSavings);
            const equityDelta = formatDelta(row.deltaTotalPropertyEquity);
            const debtDelta = formatDelta(row.deltaYearlyDebtExposure);
            return (
              <tr key={row.applicationId}>
                <td className="px-3 py-2.5 font-medium text-slate-700">
                  {row.academicYear}
                  <span className="ml-1.5 font-mono text-xs text-slate-400">
                    {row.applicationReference}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                  {formatGBP(row.totalHouseholdNetIncome)}
                  <span className={cn("ml-2 text-xs", incomeDelta.className)}>
                    {incomeDelta.text}
                  </span>
                  {/* Epic 13 / C2 — a year whose income carries an assessor
                      adjustment says so, so the trend is never unexplained. */}
                  {row.manualAdjustment != null && row.manualAdjustment !== 0 && (
                    <span className="block text-xs font-normal text-amber-700">
                      incl. manual adj. {row.manualAdjustment > 0 ? "+" : "−"}
                      {formatGBP(Math.abs(row.manualAdjustment))}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                  {formatGBP(row.totalCashSavings)}
                  <span className={cn("ml-2 text-xs", cashDelta.className)}>
                    {cashDelta.text}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                  {formatGBP(row.totalPropertyEquity)}
                  <span className={cn("ml-2 text-xs", equityDelta.className)}>
                    {equityDelta.text}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                  {formatGBP(row.yearlyDebtExposure)}
                  <span className={cn("ml-2 text-xs", debtDelta.className)}>
                    {debtDelta.text}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {row.lifestyleSqueezeLabel ?? (
                    <span className="text-slate-300">n/a</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
