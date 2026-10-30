/**
 * Reports page — WP-18
 *
 * Server component. Single scrollable page with 5 report sections:
 *   1. Award Distribution
 *   2. School Comparison
 *   3. Income Bands
 *   4. Property Categories
 *   5. Reason Code Frequency
 *   6. Gap (Epic 21: scholarship-adjusted gap + gap by main reason)
 *
 * Round is selected via URL search param ?roundId=... (defaults to active round).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole, Role } from "@/lib/auth/roles";
import {
  getActiveRound,
  getAwardDistribution,
  getSchoolComparison,
  getIncomeBandDistribution,
  getPropertyCategoryDistribution,
  getReasonCodeFrequency,
  getGapSummary,
  getFinalYearBursaries,
  getSiblingBursarySummary,
  summariseHouseholdCombinations,
  type FinalYearBursaryRow,
  type HouseholdCombinations,
  type SchoolComparisonRow,
} from "@/lib/db/queries/reports";
import { AWARD_FUND_LABELS } from "@/lib/assessment/award-fund";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { HorizontalBarChart } from "@/components/admin/charts/horizontal-bar-chart";
import { RoundSelector } from "@/components/admin/charts/round-selector";
import { entryAcademicYearLabelOrNull } from "@/lib/schools/academic-year";
import { schoolName } from "@/lib/schools";
import type { GapSummary, GapTotals } from "@/lib/reason-codes/gap-metrics";

export const metadata: Metadata = {
  title: "Reports",
};

// ─── Section anchor nav ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: "award-distribution", label: "Award Distribution" },
  { id: "school-comparison", label: "School Comparison" },
  { id: "income-bands", label: "Income Bands" },
  { id: "property-categories", label: "Property Categories" },
  { id: "reason-codes", label: "Reason Codes" },
  { id: "gap", label: "Gap" },
  { id: "final-year-bursaries", label: "Final-Year Bursaries" },
  { id: "sibling-summary", label: "Sibling Summary" },
] as const;

function SectionNav() {
  return (
    <nav
      aria-label="Report sections"
      className="sticky top-0 z-10 -mx-6 bg-white px-6 py-3 shadow-sm border-b border-slate-100"
    >
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {SECTIONS.map((section, index) => (
          <li key={section.id} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-slate-300 select-none" aria-hidden="true">
                /
              </span>
            )}
            <a
              href={`#${section.id}`}
              className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ReportSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2
          id={`${id}-heading`}
          className="mb-5 text-base font-semibold text-primary-900"
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

// ─── School comparison cards ──────────────────────────────────────────────────

function formatPct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function SchoolCard({ row }: { row: SchoolComparisonRow }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-semibold text-primary-900 uppercase tracking-wide">
        {schoolName(row.school, "short") || row.school}
      </h3>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-xs text-slate-500">Total applications</dt>
          <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
            {row.count}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-xs text-slate-500">Avg bursary award (£)</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-primary-900">
              {row.avgBursaryAward > 0 ? formatGBP(row.avgBursaryAward) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Avg bursary award (%)</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-primary-900">
              {formatPct(row.avgBursaryAwardPct)}
            </dd>
          </div>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Avg monthly payable fees</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-primary-900">
            {row.avgMonthlyFees > 0 ? formatGBP(row.avgMonthlyFees) : "—"}
          </dd>
        </div>
      </dl>
      {row.funds.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 text-left font-semibold">By award type</th>
              <th className="py-2 text-right font-semibold">Awards</th>
              <th className="py-2 text-right font-semibold">Avg (£)</th>
              <th className="py-2 text-right font-semibold">Avg (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {row.funds.map((f) => (
              <tr key={f.fund ?? "none"}>
                <td className="py-2 text-slate-700">
                  {f.fund ? AWARD_FUND_LABELS[f.fund] : "No award type"}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-700">
                  {f.assessed}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-800">
                  {f.avgBursaryAward > 0 ? formatGBP(f.avgBursaryAward) : "—"}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-800">
                  {formatPct(f.avgBursaryAwardPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Reason code table ────────────────────────────────────────────────────────

function ReasonCodeTable({
  rows,
}: {
  rows: Array<{ code: number; label: string; count: number }>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center">
        <p className="text-sm text-slate-400">No reason codes recorded for this round.</p>
      </div>
    );
  }

  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-12">
              Rank
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-16">
              Code
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reason
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-20">
              Uses
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => {
            const barWidth = Math.round((row.count / maxCount) * 100);
            return (
              <tr key={row.code} className="hover:bg-slate-50">
                <td className="px-4 py-3 tabular-nums text-slate-400 text-xs font-medium">
                  {index + 1}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-primary-900">
                  {row.code}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <span>{row.label}</span>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary-900"
                      style={{ width: `${barWidth}%` }}
                      aria-label={`${barWidth}% of maximum`}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                  {row.count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared formatters ────────────────────────────────────────────────────────

function formatGBP(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Gap section (Epic 21 #1 + #2) ──────────────────────────────────────────

function GapFigure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-primary-900">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function GapTotalsCard({ title, totals }: { title: string; totals: GapTotals }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-primary-900">{title}</h3>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <GapFigure label="Total gap" value={formatGBP(totals.gap)} />
        <GapFigure label="Scholarship spend (incl VAT)" value={formatGBP(totals.scholarshipInclVat)} />
        <GapFigure
          label="Scholarship-adjusted gap"
          value={formatGBP(totals.adjustedGap)}
          hint="Gap with the scholarship added back"
        />
        <GapFigure
          label="Accounts"
          value={String(totals.accounts)}
          hint={`${totals.accountsWithGap} with a gap · ${totals.accountsWithScholarship} with a scholarship`}
        />
      </dl>
    </div>
  );
}

function GapByReasonTable({ summary }: { summary: GapSummary }) {
  const th = "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500";
  const td = "px-4 py-3 tabular-nums";
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className={`${th} w-14 text-left`}>Rank</th>
            <th className={`${th} w-16 text-left`}>Code</th>
            <th className={`${th} text-left`}>Main gap reason</th>
            <th className={`${th} w-24 text-right`}>Accounts</th>
            <th className={`${th} w-32 text-right`}>Total gap</th>
            <th className={`${th} w-40 text-right`}>Scholarship-adjusted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {summary.byMainReason.map((row) => (
            <tr key={row.code} className="hover:bg-slate-50">
              <td className={`${td} text-xs font-medium text-slate-400`}>{row.rank ?? "—"}</td>
              <td className={`${td} font-mono text-xs font-semibold text-primary-900`}>{row.code}</td>
              <td className="px-4 py-3 text-slate-700">{row.label}</td>
              <td className={`${td} text-right`}>{row.accounts}</td>
              <td className={`${td} text-right`}>{formatGBP(row.gap)}</td>
              <td className={`${td} text-right`}>{formatGBP(row.adjustedGap)}</td>
            </tr>
          ))}
          <tr className="hover:bg-slate-50">
            <td className={`${td} text-xs text-slate-400`}>—</td>
            <td className={td} />
            <td className="px-4 py-3 italic text-slate-500">No gap code</td>
            <td className={`${td} text-right`}>{summary.noCode.accounts}</td>
            <td className={`${td} text-right`}>{formatGBP(summary.noCode.gap)}</td>
            <td className={`${td} text-right`}>{formatGBP(summary.noCode.adjustedGap)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
            <td className="px-4 py-3" colSpan={3}>Total</td>
            <td className={`${td} text-right`}>{summary.totals.accounts}</td>
            <td className={`${td} text-right`}>{formatGBP(summary.totals.gap)}</td>
            <td className={`${td} text-right`}>{formatGBP(summary.totals.adjustedGap)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Final-year bursaries table ───────────────────────────────────────────────

function FinalYearTable({ rows }: { rows: FinalYearBursaryRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center">
        <p className="text-sm text-slate-400">
          No active bursaries are in their final school years (Y12 / Y13).
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {/* D13-1a: the bursary account exposes no reference — the child's
                name is the report's identifying column. */}
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Child
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              School
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-28">
              Academic year
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-28">
              Current year
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-32">
              Yearly payable fees
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-20">
              Siblings
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-primary-900">
                {row.childName}
              </td>
              <td className="px-4 py-3 text-slate-700">
                {schoolName(row.school, "short") || row.school}
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-700">
                {entryAcademicYearLabelOrNull(row.entryYear) ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-700">
                <span className="inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700">
                  Y{row.currentYearGroup}
                </span>
                {row.yearsRemaining === 0 && (
                  <span className="ml-1.5 text-xs text-slate-400">
                    (final year)
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                {formatGBP(row.yearlyPayableFees)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                {row.siblingCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Household award combinations ─────────────────────────────────────────────

function HouseholdCombinationTable({
  summary,
}: {
  summary: HouseholdCombinations;
}) {
  if (summary.total.households === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center">
        <p className="text-sm text-slate-400">
          No households with two or more active bursary accounts.
        </p>
      </div>
    );
  }

  const th =
    "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500";
  const td = "px-4 py-3 tabular-nums";
  // Blank, not 0, for combinations no household has — as in her table.
  const blankIfNone = (households: number, text: string) =>
    households > 0 ? text : "";

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className={`${th} text-left`}>
              Multiple award combinations within same household
            </th>
            <th className={`${th} text-right`}>Number of households</th>
            <th className={`${th} text-right`}>Number of awards</th>
            <th className={`${th} text-right`}>Total bursary support (£)</th>
            <th className={`${th} text-right`}>
              Equivalent in fee support (£)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {summary.rows.map((row) => (
            <tr key={row.label} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700">{row.label}</td>
              <td className={`${td} text-right text-slate-800`}>
                {blankIfNone(row.households, String(row.households))}
              </td>
              <td className={`${td} text-right text-slate-800`}>
                {blankIfNone(row.households, String(row.awards))}
              </td>
              <td className={`${td} text-right text-slate-800`}>
                {blankIfNone(row.households, formatGBP(row.totalBursarySupport))}
              </td>
              <td className={`${td} text-right text-slate-800`}>
                {blankIfNone(row.households, formatGBP(row.feeSupportEquivalent))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
            <td className="px-4 py-3 text-primary-900">Total</td>
            <td className={`${td} text-right text-primary-900`}>
              {summary.total.households}
            </td>
            <td className={`${td} text-right text-primary-900`}>
              {summary.total.awards}
            </td>
            <td className={`${td} text-right text-primary-900`}>
              {formatGBP(summary.total.totalBursarySupport)}
            </td>
            <td className={`${td} text-right text-primary-900`}>
              {formatGBP(summary.total.feeSupportEquivalent)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── No data placeholder ──────────────────────────────────────────────────────

function NoDataPlaceholder({ height = 200 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50"
      style={{ height }}
    >
      <p className="text-sm text-slate-400">No data for this round yet</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  // Resolve search params
  const sp = await searchParams;
  const roundIdParam =
    typeof sp.roundId === "string" ? sp.roundId : undefined;

  // Load all rounds for the selector dropdown + active round
  const { allRounds, activeRound } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const rounds = await tx.round.findMany({
        select: { id: true, academicYear: true, status: true },
        orderBy: { openDate: "desc" },
      });
      const active = await getActiveRound(tx);
      return { allRounds: rounds, activeRound: active };
    }
  );
  const selectedRoundId =
    roundIdParam && allRounds.some((r) => r.id === roundIdParam)
      ? roundIdParam
      : (activeRound?.id ?? null);

  if (!selectedRoundId || allRounds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Aggregate statistics for each assessment round.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-400">
            No assessment rounds found.{" "}
            <Link href="/rounds" className="text-primary-700 hover:underline">
              Create a round
            </Link>{" "}
            to see reports.
          </p>
        </div>
      </div>
    );
  }

  // Fetch all report data in parallel
  const [
    awardDistribution,
    schoolComparison,
    incomeBands,
    propertyCategories,
    reasonCodes,
    gapSummary,
    finalYearBursaries,
    siblingSummary,
  ] = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      Promise.all([
        getAwardDistribution(tx, selectedRoundId),
        getSchoolComparison(tx, selectedRoundId),
        getIncomeBandDistribution(tx, selectedRoundId),
        getPropertyCategoryDistribution(tx, selectedRoundId),
        getReasonCodeFrequency(tx, selectedRoundId),
        getGapSummary(tx, selectedRoundId),
        // Bursary accounts span rounds, so these two reports are not round-scoped.
        getFinalYearBursaries(tx),
        getSiblingBursarySummary(tx),
      ])
  );

  const hasAwardData = awardDistribution.some((b) => b.count > 0);
  const hasIncomeData = incomeBands.some((b) => b.count > 0);
  const hasPropertyData = propertyCategories.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Aggregate statistics for each assessment round.
          </p>
        </div>

        {/* Round selector (client component) */}
        <Suspense fallback={<div className="h-9 w-56 animate-pulse rounded-md bg-slate-100" />}>
          <RoundSelector
            rounds={allRounds}
            selectedRoundId={selectedRoundId}
          />
        </Suspense>
      </div>

      {/* Sticky in-page section nav */}
      <SectionNav />

      {/* ── Section 1: Award Distribution ──────────────────────────────────── */}
      <ReportSection id="award-distribution" title="Award Distribution">
        <p className="mb-4 text-sm text-slate-500">
          Distribution of recommended bursary award percentages across all
          applications with a recommendation.
        </p>
        {hasAwardData ? (
          <HorizontalBarChart
            data={awardDistribution.map((b) => ({
              label: b.label,
              count: b.count,
              pct: b.pct,
              highlight: b.label === "91–100%" || b.label === "76–90%",
            }))}
            height={260}
            showPct
          />
        ) : (
          <NoDataPlaceholder height={260} />
        )}
      </ReportSection>

      {/* ── Section 2: School Comparison ───────────────────────────────────── */}
      <ReportSection id="school-comparison" title="School Comparison">
        <p className="mb-4 text-sm text-slate-500">
          Side-by-side comparison of each school's applications for this
          round. The % is the bursary award as a share of the annual fees
          before VAT for the round's year (each account's own fees at the OP
          partnering school), overall and by award type.
        </p>
        {schoolComparison.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {schoolComparison.map((row) => (
              <SchoolCard key={row.school} row={row} />
            ))}
          </div>
        ) : (
          <NoDataPlaceholder height={160} />
        )}
      </ReportSection>

      {/* ── Section 3: Income Bands ─────────────────────────────────────────── */}
      <ReportSection id="income-bands" title="Income Bands">
        <p className="mb-4 text-sm text-slate-500">
          Distribution of household net income across assessed applications.
        </p>
        {hasIncomeData ? (
          <HorizontalBarChart
            data={incomeBands.map((b) => ({
              label: b.label,
              count: b.count,
              pct: b.pct,
            }))}
            height={260}
            showPct
          />
        ) : (
          <NoDataPlaceholder height={260} />
        )}
      </ReportSection>

      {/* ── Section 4: Property Categories ──────────────────────────────────── */}
      <ReportSection id="property-categories" title="Property Categories">
        <p className="mb-4 text-sm text-slate-500">
          Distribution of applicants by property ownership category.
        </p>
        {hasPropertyData ? (
          <HorizontalBarChart
            data={propertyCategories.map((p) => ({
              label: `Category ${p.category}`,
              count: p.count,
              pct: p.pct,
            }))}
            height={Math.max(200, propertyCategories.length * 56)}
            showPct
          />
        ) : (
          <NoDataPlaceholder height={200} />
        )}
      </ReportSection>

      {/* ── Section 5: Reason Code Frequency ────────────────────────────────── */}
      <ReportSection id="reason-codes" title="Reason Code Frequency">
        <p className="mb-4 text-sm text-slate-500">
          Most-used reason codes across all recommendations in this round,
          ranked by frequency.
        </p>
        <ReasonCodeTable rows={reasonCodes} />
      </ReportSection>

      {/* ── Section 6: Gap (Epic 21 #1 + #2) ───────────────────────────────── */}
      <ReportSection id="gap" title="Gap">
        <p className="mb-4 text-sm text-slate-500">
          The gap is confirmed minus recommended payable fees (negative when the
          family pays less than recommended). The scholarship-adjusted gap adds
          the scholarship spend (incl VAT) back, because scholarship costs the
          bursary fund nothing. Each account is counted once, under its
          highest-ranked gap code (ranking set in Settings).
        </p>
        {gapSummary.totals.accounts > 0 ? (
          <div className="space-y-4">
            <GapTotalsCard title="All schools" totals={gapSummary.totals} />
            {gapSummary.bySchool.length > 1 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {gapSummary.bySchool.map((s) => (
                  <GapTotalsCard
                    key={s.school}
                    title={schoolName(s.school, "short") || s.school}
                    totals={s}
                  />
                ))}
              </div>
            )}
            <GapByReasonTable summary={gapSummary} />
          </div>
        ) : (
          <NoDataPlaceholder height={160} />
        )}
      </ReportSection>

      {/* ── Section 7: Active bursaries approaching final year ───────────────── */}
      <ReportSection
        id="final-year-bursaries"
        title="Active bursaries approaching final year"
      >
        <p className="mb-4 text-sm text-slate-500">
          Active bursary holders entering their final school years (Y12 / Y13),
          to plan succession in the sibling priority order. Spans all rounds —
          not filtered by the selected round.
        </p>
        <FinalYearTable rows={finalYearBursaries} />
      </ReportSection>

      {/* ── Section 8: Sibling bursary summary ──────────────────────────────── */}
      <ReportSection id="sibling-summary" title="Sibling bursary summary">
        <p className="mb-4 text-sm text-slate-500">
          Households with two or more active bursary accounts — linked as
          siblings, or sharing a lead parent — by number of awards and school.
          Total bursary support is the combined yearly award before VAT; the
          fee support adds VAT back (20% at Trinity and Whitgift, none at the
          OP partnering school). Spans all rounds — not filtered by the
          selected round.
        </p>
        <HouseholdCombinationTable
          summary={summariseHouseholdCombinations(siblingSummary)}
        />
      </ReportSection>
    </div>
  );
}
