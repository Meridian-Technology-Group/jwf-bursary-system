/**
 * ActiveRoundHero — the dominant card for the single OPEN round on the Season
 * Ledger (`/rounds`, Round Cockpit #18, Stage E).
 *
 * Pure presentational Server Component — no hooks, no `"use client"`. The page
 * derives the tidy prop shape below from `getRoundCockpit` (stage strip +
 * pipeline + outcomes + days-to-close) so the hero never reaches into the full
 * cockpit bundle.
 *
 * Surfaces: academic year + status badge + "Closes in N days", the lifecycle
 * stage strip, headline pipeline numbers (Invited / Submitted / In Assessment /
 * Decided), the qualify / does-not-qualify outcome split, and a primary
 * "Open cockpit" CTA into `/rounds/{id}`.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StageNode } from "@/lib/db/queries/round-cockpit";
import { RoundStatusBadge } from "@/components/admin/round-status-badge";
import { RoundStageStrip } from "@/components/rounds/round-stage-strip";

export interface ActiveRoundHeroProps {
  id: string;
  academicYear: string;
  /** Whole days until close; only shown when > 0. */
  daysToClose: number;
  stageStrip: StageNode[];
  pipeline: {
    invited: number;
    submitted: number;
    inAssessment: number;
    decided: number;
  };
  outcomes: {
    qualifies: number;
    doesNotQualify: number;
  };
}

const PIPELINE_LABELS: Array<{ key: keyof ActiveRoundHeroProps["pipeline"]; label: string }> = [
  { key: "invited", label: "Invited" },
  { key: "submitted", label: "Submitted" },
  { key: "inAssessment", label: "In Assessment" },
  { key: "decided", label: "Decided" },
];

export function ActiveRoundHero({
  id,
  academicYear,
  daysToClose,
  stageStrip,
  pipeline,
  outcomes,
}: ActiveRoundHeroProps) {
  const closesLabel =
    daysToClose > 0
      ? `Closes in ${daysToClose} ${daysToClose === 1 ? "day" : "days"}`
      : null;

  const decidedTotal = outcomes.qualifies + outcomes.doesNotQualify;
  const qualifyPct =
    decidedTotal > 0
      ? Math.round((outcomes.qualifies / decidedTotal) * 100)
      : null;

  return (
    <section
      aria-labelledby="active-round-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
            Active round
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2
              id="active-round-heading"
              className="text-2xl font-semibold text-primary-900"
            >
              {academicYear}
            </h2>
            <RoundStatusBadge status="OPEN" />
            {closesLabel && (
              <span className="inline-flex items-center rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700">
                {closesLabel}
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/rounds/${id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
        >
          Open cockpit
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* ── Stage strip ────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <RoundStageStrip stages={stageStrip} />
      </div>

      {/* ── Headline numbers ───────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {PIPELINE_LABELS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3"
          >
            <p className="text-2xl font-semibold tabular-nums text-primary-900">
              {pipeline[key]}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Outcome split ──────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm">
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full bg-green-500"
            aria-hidden="true"
          />
          <span className="text-slate-600">Qualifies</span>
          <span className="font-semibold tabular-nums text-primary-900">
            {outcomes.qualifies}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full bg-slate-400"
            aria-hidden="true"
          />
          <span className="text-slate-600">Does not qualify</span>
          <span className="font-semibold tabular-nums text-primary-900">
            {outcomes.doesNotQualify}
          </span>
        </span>
        {qualifyPct !== null && (
          <span className="text-slate-500">
            {qualifyPct}% qualification rate
          </span>
        )}
      </div>
    </section>
  );
}
