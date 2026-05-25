/**
 * Assessment Rounds — the "Season Ledger" (Round Cockpit #18, Stage E).
 *
 * Server component — requires ADMIN, ASSESSOR or VIEWER role.
 *
 * Replaces the flat table with a hierarchy that mirrors how the cycle actually
 * runs: a dominant hero for the single OPEN round (with its lifecycle stage
 * strip + headline numbers, fetched via the richer `getRoundCockpit`), prompt
 * cards for DRAFT rounds, and a compact reverse-chronological ledger of CLOSED
 * rounds.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarRange, ArrowRight, Sparkles } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { listRounds } from "@/lib/db/queries/rounds";
import { getRoundCockpit } from "@/lib/db/queries/round-cockpit";
import { CreateRoundDialog } from "@/components/admin/create-round-dialog";
import { ActiveRoundHero } from "@/components/rounds/active-round-hero";
import { RoundLedgerRow } from "@/components/rounds/round-ledger-row";

export const metadata = {
  title: "Assessment Rounds",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RoundsPage() {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const { rounds, openCockpit } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const rounds = await listRounds(tx);
      const openRound = rounds.find((r) => r.status === "OPEN");
      // Only the single OPEN round needs the richer cockpit fetch (stage strip,
      // pipeline tiles, time progress). DRAFT/CLOSED rounds use list data only.
      const openCockpit = openRound
        ? await getRoundCockpit(tx, openRound.id)
        : null;
      return { rounds, openCockpit };
    }
  );

  const draftRounds = rounds.filter((r) => r.status === "DRAFT");
  const closedRounds = rounds.filter((r) => r.status === "CLOSED");

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Assessment Rounds
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your live round at a glance, with upcoming and past cycles below.
          </p>
        </div>
        <CreateRoundDialog />
      </div>

      {rounds.length === 0 ? (
        /* ── No rounds at all ──────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <CalendarRange
            className="mb-3 h-10 w-10 text-slate-300"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-500">No rounds yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Create the first assessment round to get started.
          </p>
        </div>
      ) : (
        <>
          {/* ── Active round ────────────────────────────────────────────── */}
          {openCockpit ? (
            <ActiveRoundHero
              id={openCockpit.round.id}
              academicYear={openCockpit.round.academicYear}
              daysToClose={openCockpit.timeProgress.daysToClose}
              stageStrip={openCockpit.stageStrip}
              pipeline={{
                invited: openCockpit.pipeline.invited.count,
                submitted: openCockpit.pipeline.submitted.count,
                inAssessment: openCockpit.pipeline.inAssessment.count,
                decided: openCockpit.pipeline.decided.count,
              }}
              outcomes={openCockpit.outcomes}
            />
          ) : (
            <section
              aria-labelledby="no-active-heading"
              className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"
            >
              <Sparkles
                className="mb-3 h-8 w-8 text-slate-300"
                aria-hidden="true"
              />
              <h2
                id="no-active-heading"
                className="text-base font-medium text-primary-900"
              >
                No active round
              </h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {draftRounds.length > 0
                  ? "Open one of the draft rounds below when you're ready to invite families."
                  : "Create a round to start a new assessment cycle."}
              </p>
              {draftRounds.length === 0 && (
                <div className="mt-4">
                  <CreateRoundDialog />
                </div>
              )}
            </section>
          )}

          {/* ── Draft prompts ───────────────────────────────────────────── */}
          {draftRounds.length > 0 && (
            <section aria-labelledby="draft-heading" className="space-y-3">
              <h2
                id="draft-heading"
                className="text-sm font-semibold uppercase tracking-wider text-slate-500"
              >
                Drafts
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {draftRounds.map((round) => (
                  <Link
                    key={round.id}
                    href={`/rounds/${round.id}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-4 shadow-sm transition-colors hover:border-accent-300 hover:bg-accent-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                  >
                    <div>
                      <p className="text-base font-semibold text-primary-900">
                        {round.academicYear}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Draft — open when ready
                      </p>
                    </div>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-accent-600"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Past rounds ledger ──────────────────────────────────────── */}
          {closedRounds.length > 0 && (
            <section aria-labelledby="past-heading" className="space-y-3">
              <h2
                id="past-heading"
                className="text-sm font-semibold uppercase tracking-wider text-slate-500"
              >
                Past rounds
              </h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <ul className="divide-y divide-slate-100">
                  {closedRounds.map((round) => (
                    <RoundLedgerRow
                      key={round.id}
                      id={round.id}
                      academicYear={round.academicYear}
                      status={round.status}
                      openDate={round.openDate}
                      closeDate={round.closeDate}
                      total={round.counts.total}
                      qualifies={round.statusBreakdown.qualifies}
                      doesNotQualify={round.statusBreakdown.doesNotQualify}
                    />
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
