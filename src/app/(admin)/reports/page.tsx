/**
 * Reports page — WP-18
 *
 * Server component. Single scrollable page with 5 report sections:
 *   1. Award Distribution
 *   2. School Comparison
 *   3. Income Bands
 *   4. Property Categories
 *   5. Reason Code Frequency
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
} from "@/lib/db/queries/reports";
import { prisma } from "@/lib/db/prisma";
import { HorizontalBarChart } from "@/components/admin/charts/horizontal-bar-chart";
import { RoundSelector } from "@/components/admin/charts/round-selector";

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

function SchoolCard({
  school,
  count,
  avgBursaryAwardPct,
  avgMonthlyFees,
}: {
  school: string;
  count: number;
  avgBursaryAwardPct: number;
  avgMonthlyFees: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-semibold text-primary-900 uppercase tracking-wide">
        {school}
      </h3>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-xs text-slate-500">Total applications</dt>
          <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
            {count}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Avg bursary award</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-primary-900">
            {avgBursaryAwardPct}%
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Avg monthly payable fees</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-primary-900">
            {avgMonthlyFees > 0
              ? new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP",
                  maximumFractionDigits: 0,
                }).format(avgMonthlyFees)
              : "—"}
          </dd>
        </div>
      </dl>
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
  await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  // Resolve search params
  const sp = await searchParams;
  const roundIdParam =
    typeof sp.roundId === "string" ? sp.roundId : undefined;

  // Load all rounds for the selector dropdown
  const allRounds = await prisma.round.findMany({
    select: { id: true, academicYear: true, status: true },
    orderBy: { openDate: "desc" },
  });

  // Determine selected round
  const activeRound = await getActiveRound();
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
  ] = await Promise.all([
    getAwardDistribution(selectedRoundId),
    getSchoolComparison(selectedRoundId),
    getIncomeBandDistribution(selectedRoundId),
    getPropertyCategoryDistribution(selectedRoundId),
    getReasonCodeFrequency(selectedRoundId),
  ]);

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
          Side-by-side comparison of Trinity and Whitgift applications for this
          round.
        </p>
        {schoolComparison.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {schoolComparison.map((school) => (
              <SchoolCard
                key={school.school}
                school={school.school}
                count={school.count}
                avgBursaryAwardPct={school.avgBursaryAwardPct}
                avgMonthlyFees={school.avgMonthlyFees}
              />
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
    </div>
  );
}
