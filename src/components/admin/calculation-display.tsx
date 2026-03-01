"use client";

/**
 * WP-10: Calculation Display
 *
 * Shows live calculation results updated on every form change.
 * Runs calculateAssessment() client-side (pure TypeScript — no DB).
 * Sticky sidebar panel that remains visible while scrolling the form.
 */

import * as React from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { calculateAssessment } from "@/lib/assessment/calculator";
import type { AssessmentInput, AssessmentOutput } from "@/lib/assessment/types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalculationDisplayProps {
  input: AssessmentInput;
  dishonestyFlag?: boolean;
  creditRiskFlag?: boolean;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── Result Row ───────────────────────────────────────────────────────────────

type RowSentiment = "positive" | "negative" | "neutral" | "highlight";

interface ResultRowProps {
  label: string;
  value: string;
  sentiment?: RowSentiment;
  isSub?: boolean;
  isBold?: boolean;
}

function ResultRow({
  label,
  value,
  sentiment = "neutral",
  isSub = false,
  isBold = false,
}: ResultRowProps) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-2 py-1.5",
        isSub ? "pl-3" : "",
        sentiment === "highlight"
          ? "rounded-md bg-primary-50 px-2 py-2 -mx-2"
          : ""
      )}
    >
      <span
        className={cn(
          "text-xs leading-snug",
          isSub ? "text-slate-400" : "text-slate-600",
          isBold ? "font-semibold text-slate-700" : ""
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-xs tabular-nums",
          isBold ? "font-bold text-sm" : "",
          sentiment === "positive" && "text-success-600",
          sentiment === "negative" && "text-error-600",
          sentiment === "neutral" && "text-slate-700",
          sentiment === "highlight" && "text-primary-900 font-bold"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 pt-3 first:pt-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {title}
      </span>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CalculationDisplay({
  input,
  dishonestyFlag,
  creditRiskFlag,
  className,
}: CalculationDisplayProps) {
  // Run calculation — useMemo to avoid re-running on every render
  const output: AssessmentOutput | null = React.useMemo(() => {
    // Need at least one earner and some fees to produce meaningful output
    if (input.annualFees <= 0) return null;
    try {
      return calculateAssessment(input);
    } catch {
      return null;
    }
  }, [input]);

  const hasFlags = dishonestyFlag || creditRiskFlag;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden",
        className
      )}
      role="complementary"
      aria-label="Live calculation results"
    >
      {/* Header */}
      <div className="border-b border-slate-200 bg-primary-900 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-white">Live Calculation</h2>
        <p className="mt-0.5 text-xs text-primary-300">
          Updates as you enter data
        </p>
      </div>

      {/* Flags */}
      {hasFlags && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              {dishonestyFlag && (
                <p className="text-xs font-medium text-amber-800">
                  Dishonesty flag raised
                </p>
              )}
              {creditRiskFlag && (
                <p className="text-xs font-medium text-amber-800">
                  Credit risk flag raised
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No fees placeholder */}
      {!output && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <Minus className="h-8 w-8 text-slate-200" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-400">
              Awaiting data entry
            </p>
            <p className="mt-0.5 text-xs text-slate-300">
              Set school fees to see results
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {output && (
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Stage 1 */}
          <SectionHeader title="Stage 1 — Household Income" />
          <ResultRow
            label="Total Household Net Income"
            value={fmt(output.stages.stage1_totalHouseholdNetIncome)}
            isBold
            sentiment={
              output.stages.stage1_totalHouseholdNetIncome > 0
                ? "neutral"
                : "negative"
            }
          />

          {/* Stage 2 */}
          <SectionHeader title="Stage 2 — Net Assets Valuation" />
          <ResultRow
            label="After housing, council tax &amp; savings"
            value={fmt(output.stages.stage2_netAssetsYearlyValuation)}
            isBold
            sentiment={
              output.stages.stage2_netAssetsYearlyValuation > 0
                ? "neutral"
                : "negative"
            }
          />

          {/* Stage 3 */}
          <SectionHeader title="Stage 3 — HNDI After Necessary Spend" />
          <ResultRow
            label="After utilities and food costs"
            value={fmt(output.stages.stage3_hndiAfterNS)}
            isBold
            sentiment={
              output.stages.stage3_hndiAfterNS > 0 ? "positive" : "negative"
            }
          />

          {/* Stage 4 */}
          <SectionHeader title="Stage 4 — Required Bursary" />
          <ResultRow
            label="Bursary required"
            value={fmt(output.stages.stage4_requiredBursary)}
            isBold
            sentiment={
              output.stages.stage4_requiredBursary > 0 ? "positive" : "neutral"
            }
          />

          {/* Payable Fees */}
          <SectionHeader title="Payable Fees" />
          <ResultRow
            label="Gross fees"
            value={fmt(output.payableFees.grossFees)}
            isSub
          />
          {output.payableFees.scholarshipDeduction > 0 && (
            <ResultRow
              label="Scholarship deduction"
              value={`- ${fmt(output.payableFees.scholarshipDeduction)}`}
              isSub
              sentiment="positive"
            />
          )}
          {output.payableFees.bursaryAward > 0 && (
            <ResultRow
              label="Bursary award"
              value={`- ${fmt(output.payableFees.bursaryAward)}`}
              isSub
              sentiment="positive"
            />
          )}
          <ResultRow
            label="Net yearly fees"
            value={fmt(output.payableFees.netYearlyFees)}
            isSub
          />
          {output.payableFees.vatAmount > 0 && (
            <ResultRow
              label="VAT"
              value={`+ ${fmt(output.payableFees.vatAmount)}`}
              isSub
              sentiment="negative"
            />
          )}

          {/* Summary box */}
          <div className="mt-3 space-y-1 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-primary-700">
                Yearly Payable
              </span>
              <span className="font-mono text-base font-bold text-primary-900">
                {fmt(output.payableFees.adjustedYearlyPayableFees)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-primary-700">
                Monthly Payable
              </span>
              <span className="font-mono text-base font-bold text-primary-900">
                {fmt(output.payableFees.adjustedMonthlyPayableFees)}
              </span>
            </div>
          </div>

          {/* Bursary indicator */}
          <div className="mt-3">
            {output.payableFees.bursaryAward > 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-success-600/20 bg-success-50 px-3 py-2">
                <TrendingUp
                  className="h-4 w-4 shrink-0 text-success-600"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-success-600">
                  Bursary: {fmt(output.payableFees.bursaryAward)} / year
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <TrendingDown
                  className="h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-slate-400">
                  No bursary award
                </span>
              </div>
            )}
          </div>

          {/* Percentage breakdown */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <p className="font-mono text-sm font-bold text-slate-700">
                {pct(
                  input.annualFees > 0
                    ? (output.payableFees.bursaryAward /
                        output.payableFees.grossFees) *
                        100
                    : 0
                )}
              </p>
              <p className="text-[10px] text-slate-400">Bursary %</p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <p className="font-mono text-sm font-bold text-slate-700">
                {pct(input.scholarshipPct)}
              </p>
              <p className="text-[10px] text-slate-400">Scholarship %</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer timestamp */}
      <div className="border-t border-slate-100 px-5 py-2">
        <p className="text-[10px] text-slate-300">
          Calculated live — not yet saved
        </p>
      </div>
    </div>
  );
}
