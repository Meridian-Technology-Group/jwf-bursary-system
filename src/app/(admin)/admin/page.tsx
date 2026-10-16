/**
 * BURSARY ACTIVITY DASHBOARD — /admin (Epic 23 T9).
 *
 * Charlotte's 6 Sep 2026 layout (Dashboard.xlsx): "remove all the items on
 * the current dashboard and replace the whole page with this suggestion".
 * Three bands, her labels:
 *   1. Applications & assessments management — the current open round;
 *   2. Assessment outcomes, new & internal bursary applications;
 *   3. Assessment outcomes, rolling-over bursary applications — the next round.
 *
 * Every number comes from `getDashboardData` → the pure shapers in
 * `src/lib/dashboard/shape`. Panels whose real data does not exist yet show
 * the figures stored in Settings → Dashboard sample data, badged
 * "Illustrative data", until the first real one arrives (D-18).
 */

import type { Metadata } from "next";
import type { School } from "@prisma/client";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getDashboardData } from "@/lib/db/queries/dashboard";
import { COHORTS, COHORT_LABELS, percentOf } from "@/lib/dashboard/shape";
import {
  BandHeading,
  gbp,
  KeyValues,
  longDate,
  Panel,
  PerSchoolTable,
} from "@/components/admin/dashboard/panels";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);

export default async function DashboardPage() {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  const data = await withUserContext(user.id, user.role as RlsRole, (tx) => getDashboardData(tx), {
    timeoutMs: 30_000,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-center font-serif text-2xl font-semibold tracking-wide text-primary-900">
        BURSARY ACTIVITY DASHBOARD
      </h1>

      {!data.current ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No assessment round yet. Create one on the Rounds page.
        </p>
      ) : (
        <>
          <Band1 data={data} />
          <Band2 data={data} />
          <Band3 data={data} />
        </>
      )}
    </div>
  );
}

type Data = Awaited<ReturnType<typeof getDashboardData>>;

function Band1({ data }: { data: Data }) {
  const cur = data.current!;
  const b = data.band1!;
  const queue = (status: string) => (s: School) => `/queue?roundId=${cur.roundId}&status=${status}&school=${s}`;
  return (
    <section className="space-y-4" aria-labelledby="band-1">
      <BandHeading>
        <span id="band-1">Applications &amp; assessments management</span>
      </BandHeading>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Current open round">
          <KeyValues
            rows={[
              { label: "The current round relates to this academic year:", value: cur.academicYearLabel },
              { label: "The assessments look at this tax year:", value: cur.taxYear },
              { label: "Number of New Application Invitations sent out for this round", value: b.totals.newInvitesSent },
              { label: "Number of New Applications received for this round", value: b.totals.newReceived },
            ]}
          />
        </Panel>

        <Panel title="Bursary applications — current round">
          <PerSchoolTable
            schools={b.schools}
            rows={[
              { label: "Number of New Application Invitations sent", values: b.newInvitesSent },
              { label: "Number of New Applications received", values: b.newReceived },
              { label: "Number of Rolling-over Applications due", values: b.rollingDue },
              { label: "Total applications", values: b.total, emphasis: true },
            ]}
          />
        </Panel>

        <Panel title="Bursary assessments — current round">
          <PerSchoolTable
            schools={b.schools}
            rows={[
              { label: "Number of Assessments waiting to be started", values: b.waiting, href: queue("SUBMITTED") },
              { label: "Number of Assessments Paused", values: b.paused, href: queue("PAUSED") },
              { label: "Number of Assessments Completed", values: b.completed },
            ]}
          />
        </Panel>
      </div>
    </section>
  );
}

function SpendTable({ schools, cells }: { schools: School[]; cells: Record<School, { spend: number; awards: number }> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-slate-500">
          <th className="py-1 text-left font-medium" />
          <th className="py-1 text-right font-medium">Total spend (before VAT)</th>
          <th className="w-24 py-1 text-right font-medium">Number of awards</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {schools.map((s) => (
          <tr key={s}>
            <td className="py-1.5 text-slate-600">{s === "TRINITY" ? "TS" : s === "WHITGIFT" ? "WS" : "OP"}</td>
            <td className="py-1.5 text-right tabular-nums">{gbp(cells[s].spend)}</td>
            <td className="py-1.5 text-right tabular-nums">{cells[s].awards}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Band2({ data }: { data: Data }) {
  const b = data.band2!;
  const reasons = data.closedReasons!;
  const start = Number(data.current!.academicYear.slice(0, 4));
  const yy = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  return (
    <section className="space-y-4" aria-labelledby="band-2">
      <BandHeading>
        <span id="band-2">Assessment outcomes — new &amp; internal bursary applications</span>
      </BandHeading>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="New bursary awards and closures — current round">
          <PerSchoolTable
            schools={b.schools}
            rows={[
              { label: "Number of Assessments with a new Bursary Award in this current round", values: b.newAwards },
              { label: "Number of Assessments closed - no bursary awarded in this current round", values: b.closedNoAward },
            ]}
          />
        </Panel>

        <Panel title="New bursary awarded spends">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">For {yy(start)} (internal bursaries)</p>
            <SpendTable schools={b.schools} cells={b.spendCurrentYear} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">For {yy(start + 1)} (new applications)</p>
            <SpendTable schools={b.schools} cells={b.spendNextYear} />
          </div>
        </Panel>

        <Panel
          title="Current round — new applications — top 5 of closed applications' reasons"
          subtitle="TS & WS"
          illustrative={reasons.illustrative}
        >
          <ol className="space-y-1.5">
            {reasons.data.map((r, i) => (
              <li key={r.label} className="flex items-baseline gap-3">
                <span className="w-4 shrink-0 text-right text-xs text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 text-slate-700">{r.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-primary-900">{pct(Math.round(r.share * 1000) / 10)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </section>
  );
}

function Band3({ data }: { data: Data }) {
  const next = data.next;
  const b = data.band3!;
  const spend = data.committedSpend!;
  const yoy = data.yoyChanges!;
  const t = b.scheduledTotal;
  const progress: { label: string; n: number; by?: Date | null }[] = [
    { label: "Rolling-over Applications sent", n: b.progress.sent, by: next?.opensOn },
    { label: "Number of Assessments Received", n: b.progress.received, by: next?.submitBy },
    { label: "Number of Assessments waiting to be started", n: b.progress.waiting },
    { label: "Number of Assessments paused", n: b.progress.paused },
    { label: "Number of Assessments/accounts closed", n: b.progress.closed },
    { label: "Number of Assessments completed with award", n: b.progress.completedWithAward, by: next?.assessmentsDoneBy },
  ];
  return (
    <section className="space-y-4" aria-labelledby="band-3">
      <BandHeading>
        <span id="band-3">Assessment outcomes — rolling-over bursary applications</span>
      </BandHeading>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Next round details">
          <KeyValues
            rows={[
              { label: "Future round academic year", value: next?.academicYearLabel ?? "—" },
              { label: "Future round tax year", value: next?.taxYear ?? "—" },
              { label: "Submission date by", value: longDate(next?.submitBy) },
            ]}
          />
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Number of Scheduled Rolling-Over Assessments</p>
            <KeyValues
              rows={[
                ...COHORTS.map((c) => ({ label: COHORT_LABELS[c], value: b.cohorts[c] })),
                { label: "Total", value: t },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Assessment progress snapshot">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1 text-left font-medium">To be done by</th>
                <th className="py-1 text-left font-medium">Progress stats</th>
                <th className="py-1 text-right font-medium">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {progress.map((p) => (
                <tr key={p.label}>
                  <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-slate-500">{p.by ? longDate(p.by) : ""}</td>
                  <td className="py-1.5 pr-2 text-slate-600">{p.label}</td>
                  <td className="whitespace-nowrap py-1.5 text-right tabular-nums">
                    <span className="font-semibold text-primary-900">{p.n}</span>
                    <span className="ml-1 text-xs text-slate-500">({pct(percentOf(p.n, t))})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Rolling-over new committed spend (complete assessments)
              </p>
              {spend.illustrative && (
                <span className="text-[11px] font-medium uppercase tracking-wide text-accent-700">Illustrative data</span>
              )}
            </div>
            <KeyValues
              rows={[
                { label: "ex-OP", value: gbp(spend.data.exOp) },
                { label: "TS", value: gbp(spend.data.ts) },
                { label: "WS", value: gbp(spend.data.ws) },
              ]}
            />
          </div>
        </Panel>

        <Panel
          title="Next round — assessments — top 10 of year-to-year changes selected"
          subtitle="in completed assessments"
          illustrative={yoy.illustrative}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1 text-left font-medium">Reasons</th>
                <th className="w-24 py-1 text-right font-medium">Number of recurrences</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {yoy.data.map((r, i) => (
                <tr key={r.label}>
                  <td className="py-1.5 pr-2 text-slate-700">
                    <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                    {r.label}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-primary-900">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </section>
  );
}

