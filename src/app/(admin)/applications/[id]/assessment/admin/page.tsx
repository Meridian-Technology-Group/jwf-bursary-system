/**
 * ASSESSMENT ADMIN — Epic 14 C8 (CG-24, US-C9, LA-7).
 *
 * The workbook's sheet-3 blocks, top to bottom:
 *  1. Header strip: recipient name · Bursary Reference · school · siblings
 *     (the "Fees Account Code" column renders `Application.reference` —
 *     Epic 13 D13-1a dropped the separate code).
 *  2. Account Synopsis (existing component + save path) and the Assessor's
 *     wizard notes editor (relocated from the form's section F — same
 *     storage/save, read-only once COMPLETED), plus the previous year's
 *     wizard callout.
 *  3. Year-on-year history table: system years from prior COMPLETED
 *     assessments' snapshots (CALC-10 read), pre-system years as manual rows
 *     (LA-7 — `BursaryAccount.preSystemHistory`), deltas computed across the
 *     whole sequence. Living arrangement is a manual pre-system cell; system
 *     rows show "—" (note B, Charlotte to confirm a derivation if wanted).
 *  4. Payable-fees schedule: one row per Epic 10 schedule year with reason
 *     codes, payable fees + Δ, school year, submit-by and the three statuses;
 *     future rows read "Scheduled / Not started".
 *
 * Epic 21 #3: this page is the "door" to previous years (as in Grant
 * Tracker). Each schedule year, year-on-year row and the wizard callout links
 * to that year's assessment; the year being viewed reads "This year". Links
 * resolve under the viewer's own RLS context, so an ASSESSOR only sees links
 * to applications assigned to them (D-4).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAssessment, getYoyFinancialsRows } from "@/lib/db/queries/assessments";
import { getPreviousWatchOutNotes } from "@/lib/db/queries/reassessment";
import { getPayableFeesScheduleRows } from "@/lib/db/queries/payable-fees-schedule";
import { deriveReviewPhase } from "@/lib/applications/status";
import {
  mergeYoyHistory,
  scaffoldAcademicYears,
  priorAcademicYear,
  parsePreSystemHistory,
} from "@/lib/assessments/admin-tab";
import { formatLondonDate } from "@/lib/datetime";
import { scheduleRowLink } from "@/lib/assessment/previous-year";
import { cn } from "@/lib/utils";
import { AssessmentSynopsis } from "@/components/admin/assessment-synopsis";
import { AccountSynopsisCard } from "@/components/admin/account-synopsis-card";
import { getAccountSynopsisTimeline } from "@/lib/db/queries/account-synopsis";
import { WatchOutNotesEditor } from "@/components/admin/watch-out-notes-editor";
import { PreSystemHistoryEditor } from "@/components/admin/pre-system-history-editor";
import { AnnualFeesOverrideEditor } from "@/components/admin/annual-fees-override-editor";
import { CloseBursaryAccountDialog } from "@/components/admin/close-bursary-account-dialog";
import { ScheduleEndAddControls } from "@/components/admin/schedule-end-add-controls";
import {
  resolveScheduleHorizon,
  scheduleEditControls,
} from "@/lib/bursary-accounts/schedule";
import { getAllCloseReasons } from "@/lib/db/queries/reference-tables";
import type { SiblingDetail } from "@/types/assessment-v2";
import { schoolHasFeeTable, schoolName } from "@/lib/schools";

export const metadata = {
  title: "Assessment — Admin",
};

interface Props {
  params: { id: string };
}

function money(v: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(v);
}

function signedMoney(v: number | null): string {
  if (v == null) return "n/a";
  const s = money(Math.abs(v));
  return v < 0 ? `-${s}` : v > 0 ? `+${s}` : s;
}

export default async function AssessmentAdminPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  const isViewer = user.role === Role.VIEWER;

  const {
    application,
    assessment,
    watchOut,
    childName,
    yoyRows,
    preSystem,
    scheduleRows,
    accountStatus,
    closeReasons,
    accountFees,
    scheduleControls,
    synopsisTimeline,
  } = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
    const app = await getApplicationWithDetails(tx, params.id);
    if (!app) {
      return {
        application: null,
        assessment: null,
        watchOut: null,
        childName: null as string | null,
        yoyRows: [],
        preSystem: [],
        scheduleRows: [],
        accountStatus: null,
        closeReasons: [],
        accountFees: null,
        scheduleControls: null,
        synopsisTimeline: null,
      };
    }
    const a = await getAssessment(tx, params.id);
    const notes = app.bursaryAccountId
      ? await getPreviousWatchOutNotes(tx, app.bursaryAccountId, params.id)
      : null;
    // Name disclosure already audited by the detail layout's header reveal
    // for this same page view.
    const nameRow = await tx.application.findUnique({
      where: { id: params.id },
      select: { childName: true },
    });
    const yoy = app.bursaryAccountId
      ? await getYoyFinancialsRows(tx, app.bursaryAccountId)
      : [];
    const account = app.bursaryAccountId
      ? await tx.bursaryAccount.findUnique({
          where: { id: app.bursaryAccountId },
          select: {
            preSystemHistory: true,
            status: true,
            school: true,
            annualFeesOverride: true,
            // Epic 21 #4 — End after this year / Add a year.
            entryYearGroup: true,
            firstAssessmentYear: true,
            scheduleEntries: {
              orderBy: { scheduleYear: "asc" },
              select: { id: true, scheduleYear: true, academicYear: true, status: true, applicationId: true },
            },
          },
        })
      : null;
    // Epic 18b — the manual account close's reason picker (ADMIN only).
    const reasons =
      user.role === Role.ADMIN && account?.status === "ACTIVE"
        ? (await getAllCloseReasons(tx))
            .filter((r) => !r.isDeprecated)
            .map((r) => ({ id: r.id, label: r.label }))
        : [];
    const schedule = app.bursaryAccountId
      ? await getPayableFeesScheduleRows(tx, app.bursaryAccountId)
      : [];
    // Epic 21 #6 — the account's standing synopsis (all years).
    const timeline = app.bursaryAccountId
      ? await getAccountSynopsisTimeline(tx, app.bursaryAccountId)
      : null;
    // Epic 21 #4 — ADMIN only; each button enabled only when its action would succeed.
    const controls =
      user.role === Role.ADMIN && account
        ? scheduleEditControls({
            rows: account.scheduleEntries,
            applicationId: params.id,
            roundAcademicYear: app.round.academicYear,
            firstAssessmentYear: account.firstAssessmentYear,
            naturalHorizon: resolveScheduleHorizon(account.entryYearGroup, undefined, account.school),
            school: account.school,
            accountClosed: account.status === "CLOSED",
          })
        : null;
    return {
      application: app,
      assessment: a,
      watchOut: notes,
      childName: nameRow?.childName ?? null,
      yoyRows: yoy,
      preSystem: parsePreSystemHistory(account?.preSystemHistory),
      scheduleRows: schedule,
      accountStatus: account?.status ?? null,
      closeReasons: reasons,
      scheduleControls: controls,
      synopsisTimeline: timeline,
      // S9: shown where the school has no fee table (the OP partnering school),
      // or wherever an override has been set.
      accountFees:
        account &&
        (!schoolHasFeeTable(account.school) || account.annualFeesOverride != null)
          ? {
              value:
                account.annualFeesOverride == null
                  ? null
                  : Number(account.annualFeesOverride),
            }
          : null,
    };
  });
  if (!application) notFound();

  const reviewPhase = deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: assessment?.status ?? null,
    outcome: assessment?.outcome ?? null,
    closedAt: application.closedAt,
  });
  if (reviewPhase === "PRE_SUBMISSION") {
    redirect(`/applications/${params.id}`);
  }

  const siblingNames = (
    (assessment?.siblingDetails ?? []) as SiblingDetail[]
  )
    .map((d) => (d?.name ?? "").trim())
    .filter(Boolean);

  const historyRows = mergeYoyHistory(preSystem, yoyRows);

  // Epic 15 M7 (CI-13): the empty-table scaffolds' year spine — from the
  // application's round year across the account's plausible horizon (sized
  // by the assessment's remaining-years figure when it has one).
  const scaffoldYears = scaffoldAcademicYears(
    application.round.academicYear,
    assessment?.schoolingYearsRemaining ?? null
  );
  // CH-56 — the history table's spine sits one year behind the schedule's. Its
  // figures are the completed tax year the assessment was based on, not the
  // academic year the award covers. The schedule below keeps the round year.
  const historyScaffoldYears = scaffoldAcademicYears(
    priorAcademicYear(application.round.academicYear),
    assessment?.schoolingYearsRemaining ?? null
  );
  const assessmentReadOnly =
    isViewer || !assessment || assessment.status === "COMPLETED";

  return (
    <div className="space-y-5">
      {/* 1. Header strip (sheet-3: name · reference · school · siblings;
          Fees Account Code = the editable Application.reference, D13-1a). */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm shadow-sm">
        {childName && (
          <span className="font-semibold text-primary-900">{childName}</span>
        )}
        <span className="font-mono font-semibold text-primary-900">
          {application.reference}
        </span>
        <span className="text-slate-600">
          {schoolName(application.school)}
        </span>
        <span className="text-slate-500">
          {application.round.academicYear} assessment round
        </span>
        {siblingNames.length > 0 && (
          <span className="text-slate-500">
            Siblings: <span className="text-slate-700">{siblingNames.join(", ")}</span>
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {accountStatus === "CLOSED" && (
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account closed
            </span>
          )}
          {/* Epic 21 #4 — her conditional bursary: end the schedule after
              this year, or add a year back. ADMIN only. */}
          {scheduleControls && (
            <ScheduleEndAddControls
              applicationId={params.id}
              end={scheduleControls.end}
              add={scheduleControls.add}
            />
          )}
          {/* Epic 18b — her April–May leavers window: close the ACTIVE account
              with a structured reason. ADMIN only; hidden once closed. */}
          {user.role === Role.ADMIN &&
            accountStatus === "ACTIVE" &&
            application.bursaryAccountId && (
              <CloseBursaryAccountDialog
                bursaryAccountId={application.bursaryAccountId}
                applicationId={params.id}
                closeReasons={closeReasons}
              />
            )}
        </span>
      </div>

      {/* Previous assessor's wizard notes (CALC-10) — read-only context. */}
      {watchOut && (
        <div
          role="note"
          aria-label="Assessor's wizard"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <Lightbulb
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Assessor&apos;s wizard — from{" "}
              <Link
                href={`/applications/${watchOut.applicationId}/assessment`}
                className="underline underline-offset-2 hover:text-amber-700"
              >
                {watchOut.academicYear}
              </Link>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">
              {watchOut.watchOutNotes}
            </p>
          </div>
        </div>
      )}

      {/* Epic 21 #6 — the standing synopsis across every year of the account,
          above this year's (her 11 Oct question: "the generic one that
          sustains all years"). */}
      {synopsisTimeline && (
        <AccountSynopsisCard
          applicationId={params.id}
          entries={synopsisTimeline.map((e) => ({
            ...e,
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
          }))}
          canAddNote={user.role === Role.ADMIN || user.role === Role.ASSESSOR}
          canEditNotes={user.role === Role.ADMIN}
        />
      )}

      {/* 2. This year's synopsis + wizard notes. */}
      {assessment ? (
        <>
          <AssessmentSynopsis
            assessmentId={assessment.id}
            applicationId={params.id}
            synopsis={assessment.synopsis}
            assessmentCompleted={assessment.status === "COMPLETED"}
            title="This year's synopsis"
          />
          <WatchOutNotesEditor
            assessmentId={assessment.id}
            applicationId={params.id}
            initial={assessment.watchOutNotes}
            readOnly={assessmentReadOnly}
          />
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">
            The account synopsis and wizard notes become available once the
            assessment has been started (Assessment Model tab).
          </p>
        </div>
      )}

      {/* S9 — the account's own annual fees (OP partnering school: no fee table). */}
      {accountFees && application.bursaryAccountId && (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Account annual fees
          </p>
          <p className="text-xs text-slate-500">
            This school has no fee table, so the assessment uses this account&apos;s own
            fee. No VAT is added.
          </p>
          <AnnualFeesOverrideEditor
            bursaryAccountId={application.bursaryAccountId}
            applicationId={params.id}
            initial={accountFees.value}
            readOnly={user.role !== Role.ADMIN}
          />
        </section>
      )}

      {/* 3. Year-on-year history. */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Charlotte's title, 10 Sep 2026. */}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Δ Year on Year Assessment View
        </p>

        {application.bursaryAccountId && (
          <PreSystemHistoryEditor
            bursaryAccountId={application.bursaryAccountId}
            applicationId={params.id}
            initial={preSystem}
            readOnly={isViewer}
          />
        )}

        {historyRows.length === 0 ? (
          /* Epic 15 M7 (CI-13): the empty state renders the table SCAFFOLD —
             full headers + a row per academic year — so the shape of what is
             coming is visible at a glance. Cells fill as assessments
             complete (or via pre-system years above). */
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {/* CH-56b — Charlotte, 25 Aug: "Let's call it 'Financial Assessment
                      year' as it could be the previous tax year or the one
                      before that." CH-56 moved the value back a year and left
                      this header saying "Assessment Year", which was then
                      wrong. Her wording is deliberately loose because the
                      figures are not always the immediately preceding year. */}
                  <th className="px-3 py-2">Financial Assessment year</th>
                  <th className="px-3 py-2 text-right">Overall net income</th>
                  <th className="px-3 py-2 text-right">Total savings</th>
                  <th className="px-3 py-2 text-right">Property equity</th>
                  <th className="px-3 py-2 text-right">Total debt</th>
                  <th className="px-3 py-2 text-right">Δ Income</th>
                  <th className="px-3 py-2 text-right">Δ Savings</th>
                  <th className="px-3 py-2 text-right">Δ Equity</th>
                  <th className="px-3 py-2 text-right">Δ Debt</th>
                  <th className="px-3 py-2 text-right">Total benefits</th>
                  <th className="px-3 py-2 text-right">Δ Benefits</th>
                </tr>
              </thead>
              <tbody>
                {historyScaffoldYears.map((year) => (
                  <tr key={year} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-400">
                      {year}
                    </td>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <td key={i} className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                        —
                      </td>
                    ))}
                    <td className="px-3 py-2 text-xs text-slate-300">—</td>
                    <td className="px-3 py-2 text-xs text-slate-300">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {/* CH-56b — Charlotte, 25 Aug: "Let's call it 'Financial Assessment
                      year' as it could be the previous tax year or the one
                      before that." CH-56 moved the value back a year and left
                      this header saying "Assessment Year", which was then
                      wrong. Her wording is deliberately loose because the
                      figures are not always the immediately preceding year. */}
                  <th className="px-3 py-2">Financial Assessment year</th>
                  <th className="px-3 py-2 text-right">Overall net income</th>
                  <th className="px-3 py-2 text-right">Total savings</th>
                  <th className="px-3 py-2 text-right">Property equity</th>
                  <th className="px-3 py-2 text-right">Total debt</th>
                  <th className="px-3 py-2 text-right">Δ Income</th>
                  <th className="px-3 py-2 text-right">Δ Savings</th>
                  <th className="px-3 py-2 text-right">Δ Equity</th>
                  <th className="px-3 py-2 text-right">Δ Debt</th>
                  <th className="px-3 py-2 text-right">Total benefits</th>
                  <th className="px-3 py-2 text-right">Δ Benefits</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr
                    key={row.academicYear}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-primary-900">
                      {/* CH-56 — label the completed tax year the figures came
                          from, not the award's academic year. Epic 21 #3:
                          a system row links to that year's assessment. */}
                      {row.applicationId && row.applicationId !== params.id ? (
                        <Link
                          href={`/applications/${row.applicationId}/assessment`}
                          className="underline underline-offset-2 hover:text-primary-700"
                        >
                          {priorAcademicYear(row.academicYear)}
                        </Link>
                      ) : (
                        priorAcademicYear(row.academicYear)
                      )}
                      {row.source === "MANUAL" && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500">
                          manual
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(row.netIncome)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(row.savings)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(row.propertyEquity)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(row.debtExposure)}</td>
                    {[row.deltaNetIncome, row.deltaSavings, row.deltaPropertyEquity, row.deltaDebtExposure].map(
                      (d, i) => (
                        <td
                          key={i}
                          className={cn(
                            "px-3 py-2 text-right font-mono text-xs",
                            d != null && d < 0 && "text-red-700",
                            d != null && d > 0 && "text-green-700"
                          )}
                        >
                          {signedMoney(d)}
                        </td>
                      )
                    )}
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {money(row.totalBenefits)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono text-xs",
                        row.deltaTotalBenefits != null && row.deltaTotalBenefits < 0 && "text-red-700",
                        row.deltaTotalBenefits != null && row.deltaTotalBenefits > 0 && "text-green-700"
                      )}
                    >
                      {signedMoney(row.deltaTotalBenefits)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Payable-fees schedule. */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Payable-fees schedule
        </p>
        {scheduleRows.length === 0 ? (
          /* Epic 15 M7 (CI-13): scaffolded schedule — the real rows generate
             when the bursary account is awarded (Epic 10). */
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Academic Year</th>
                  <th className="px-3 py-2">Year on Year Assessment Comments re Payable Fees Change</th>
                  <th className="px-3 py-2 text-right">Payable fees</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                  <th className="px-3 py-2">School Year</th>
                  {/* Charlotte, 10 Sep 2026 — her two extra columns. */}
                  <th className="px-3 py-2 text-right">Bursary award (before VAT)</th>
                  <th className="px-3 py-2">Bursary Award Type</th>
                  <th className="px-3 py-2">App to be submitted by</th>
                  <th className="px-3 py-2">Application Status</th>
                  <th className="px-3 py-2">Assessment Status</th>
                  <th className="px-3 py-2">Bursary Status</th>
                </tr>
              </thead>
              <tbody>
                {scaffoldYears.map((year) => (
                  <tr key={year} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-400">
                      {year}
                    </td>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <td key={i} className="px-3 py-2 text-xs text-slate-300">
                        —
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Academic Year</th>
                  <th className="px-3 py-2">Year on Year Assessment Comments re Payable Fees Change</th>
                  <th className="px-3 py-2 text-right">Payable fees</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                  <th className="px-3 py-2">School Year</th>
                  {/* Charlotte, 10 Sep 2026 — her two extra columns. */}
                  <th className="px-3 py-2 text-right">Bursary award (before VAT)</th>
                  <th className="px-3 py-2">Bursary Award Type</th>
                  <th className="px-3 py-2">App to be submitted by</th>
                  <th className="px-3 py-2">Application Status</th>
                  <th className="px-3 py-2">Assessment Status</th>
                  <th className="px-3 py-2">Bursary Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => {
                  // Epic 21 #3 — the door to that year's assessment.
                  const link = scheduleRowLink(row, params.id);
                  return (
                  <tr
                    key={row.scheduleYear}
                    className={cn(
                      "border-b border-slate-100 last:border-b-0",
                      link.kind === "current" && "bg-accent-50/60"
                    )}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-primary-900">
                      {link.kind === "link" ? (
                        <Link
                          href={link.href}
                          className="underline underline-offset-2 hover:text-primary-700"
                        >
                          {row.academicYear}
                        </Link>
                      ) : (
                        row.academicYear
                      )}
                      {link.kind === "current" && (
                        <span className="ml-1.5 inline-block whitespace-nowrap rounded bg-accent-100 px-1 py-0.5 font-sans text-[10px] font-medium text-accent-800">
                          This year
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {row.reasonCodes.length > 0 ? row.reasonCodes.join("; ") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(row.payableFees)}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono text-xs",
                        row.deltaPayableFees != null && row.deltaPayableFees < 0 && "text-red-700",
                        row.deltaPayableFees != null && row.deltaPayableFees > 0 && "text-green-700"
                      )}
                    >
                      {signedMoney(row.deltaPayableFees)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.schoolYearLabel ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {money(row.bursaryAward)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {row.awardFundLabel ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {row.submitBy ? formatLondonDate(row.submitBy) : "—"}
                      {/* Epic 21 R2 — this family's own deadline when it differs. */}
                      {row.familyDeadline && (
                        <span className="block whitespace-nowrap font-medium text-amber-700">
                          Family: {formatLondonDate(row.familyDeadline)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.applicationStatus}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.assessmentStatus}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.bursaryStatus}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
