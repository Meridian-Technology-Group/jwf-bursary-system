/**
 * Assessments queue — Epic 14 C1 (CG-17, US-C1).
 *
 * A dedicated list of ASSESSMENTS, separate from the applications queue: every
 * SUBMITTED application appears as an assessment to be worked, with a derived
 * status (due / in progress / paused / completed / locked-by-outcome — see
 * `deriveAssessmentQueueStatus`), the assignee, and the round. Row-click opens
 * the assessment workspace. No schema change — this is a projection over
 * existing `Application` + `Assessment` data.
 *
 * Role scoping mirrors `applications/[id]/layout.tsx`: an ASSESSOR sees only
 * assessments assigned to them; ADMIN/VIEWER see all and can filter by
 * assignee.
 */

import Link from "next/link";
import { BulkLockRolledOverButton } from "@/components/admin/bulk-lock-rolled-over-button";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import {
  listAssessmentQueueRows,
  type AssessmentQueueRow,
} from "@/lib/db/queries/assessments-queue";
import {
  ALL_ASSESSMENT_QUEUE_STATUSES,
  ASSESSMENT_QUEUE_STATUS_LABELS,
  type AssessmentQueueStatus,
} from "@/lib/assessments/queue-status";
import {
  filterAssessmentQueueRows,
  academicYearOptions,
  parseDateBoundary,
} from "@/lib/assessments/queue-filters";
import type { School, BursaryAccountStatus } from "@prisma/client";
import { listStaffUsers } from "@/lib/db/queries/profiles";
import { formatLondonDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = {
  title: "Assessments",
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * CH-45 — sortable Submitted column. Charlotte: *"Can I have the option when I
 * click on the submitted column header for the assessments to be re-ordered
 * chronologically?"* She later confirmed the sort she had seen was on the
 * Applications page, not here.
 *
 * Done as a search param on this server component rather than by converting the
 * table to the Applications page's client-side `@tanstack/react-table` setup —
 * that would be a large refactor of a page she uses daily, for one column. The
 * affordance and the chevrons match the other table.
 */
type SubmittedSort = "submitted_asc" | "submitted_desc";

function parseSort(value: string | string[] | undefined): SubmittedSort | undefined {
  const raw = firstValue(value);
  return raw === "submitted_asc" || raw === "submitted_desc" ? raw : undefined;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const STATUSES = new Set<string>(ALL_ASSESSMENT_QUEUE_STATUSES);

function parseStatus(
  value: string | string[] | undefined
): AssessmentQueueStatus | undefined {
  const raw = firstValue(value);
  return raw && STATUSES.has(raw) ? (raw as AssessmentQueueStatus) : undefined;
}

function parseBursaryStatus(
  value: string | string[] | undefined
): BursaryAccountStatus | undefined {
  const raw = firstValue(value);
  return raw === "ACTIVE" || raw === "CLOSED" ? raw : undefined;
}

function parseSchool(value: string | string[] | undefined): School | undefined {
  const raw = firstValue(value);
  return raw === "TRINITY" || raw === "WHITGIFT" ? raw : undefined;
}

function parseDateParam(value: string | string[] | undefined): string | undefined {
  const raw = firstValue(value);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

/**
 * Charlotte, 8 Sep 2026 — the bursary ACCOUNT's own status, alongside the
 * assessment status: *"Levi Amoah would show as a closed account and with the
 * locked-decided outcome, and Langazye Kaluba would show as an active account
 * with a locked-decided outcome for the round 2026-27."*
 */
function BursaryStatusBadge({ status }: { status: BursaryAccountStatus | null }) {
  if (!status) {
    return <span className="text-slate-400">No account</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        status === "ACTIVE"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-100 text-slate-600 border-slate-200"
      )}
    >
      {status === "ACTIVE" ? "Active" : "Closed"}
    </span>
  );
}

const STATUS_BADGE_CLASSES: Record<AssessmentQueueStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  PAUSED: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  LOCKED: "bg-slate-800 text-white border-slate-800",
};

function StatusBadge({ status }: { status: AssessmentQueueStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_BADGE_CLASSES[status]
      )}
    >
      {ASSESSMENT_QUEUE_STATUS_LABELS[status]}
    </span>
  );
}

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  const params = await searchParams;

  const statusFilter = parseStatus(params.status);
  const sort = parseSort(params.sort);
  const bursaryFilter = parseBursaryStatus(params.bursary);
  const yearFilter = firstValue(params.year);
  const schoolFilter = parseSchool(params.school);
  const fromParam = parseDateParam(params.from);
  const toParam = parseDateParam(params.to);
  const assigneeFilter =
    user.role === Role.ASSESSOR ? user.id : firstValue(params.assignee);

  const [rows, staff, rolledOverLockable] = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const queueRows = await listAssessmentQueueRows(tx, {
        assignedToId: assigneeFilter || undefined,
      });
      // ASSESSORs don't need the assignee filter (they only see their own).
      const staffUsers =
        user.role === Role.ASSESSOR
          ? []
          : (await listStaffUsers(tx)).filter((s) => s.role !== "DELETED");
      // Epic 18b — the mid-September bulk lock's eligible count (ADMIN only;
      // the action re-derives the set authoritatively).
      const lockable =
        user.role === Role.ADMIN
          ? await tx.assessment.count({
              where: {
                status: "COMPLETED",
                application: {
                  applicationType: "ROLLING_OVER",
                  formStatus: "SUBMITTED",
                },
              },
            })
          : 0;
      return [queueRows, staffUsers, lockable] as const;
    }
  );

  // Her five filters compose (AND). Assessment status stays the chip row above
  // — the chips carry per-status counts, which a dropdown would lose.
  const narrowed = filterAssessmentQueueRows(rows, {
    bursaryStatus: bursaryFilter,
    academicYear: yearFilter,
    school: schoolFilter,
    submittedFrom: parseDateBoundary(fromParam, "start"),
    submittedTo: parseDateBoundary(toParam, "end"),
  });

  const filtered = statusFilter
    ? narrowed.filter((r) => r.status === statusFilter)
    : narrowed;

  // CH-45 — the query already returns submittedAt ascending, so no sort param
  // leaves the existing order untouched. Nulls sort last either way: an
  // application with no submission date has nothing to order by, and burying it
  // at the bottom beats it jumping to the top when she flips direction.
  const visible = sort
    ? [...filtered].sort((a, b) => {
        const at = a.submittedAt?.getTime();
        const bt = b.submittedAt?.getTime();
        if (at === undefined && bt === undefined) return 0;
        if (at === undefined) return 1;
        if (bt === undefined) return -1;
        return sort === "submitted_asc" ? at - bt : bt - at;
      })
    : filtered;

  // Counts are taken from the OTHER filters' result, not the raw rows: with a
  // round or school selected, a chip claiming a count the list cannot show
  // would misdirect exactly when she is aiming the bulk lock.
  const counts = new Map<AssessmentQueueStatus, number>();
  for (const r of narrowed) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  const yearOptions = academicYearOptions(rows);

  /**
   * Every link on this page rebuilds the full query string. With six filters
   * now composing, dropping one on a chip click or a sort would silently widen
   * the list she is about to bulk-lock from, so the params are built in one
   * place and only the named override changes.
   */
  const hrefWith = (
    overrides: {
      status?: AssessmentQueueStatus | null;
      sort?: SubmittedSort | null;
    } = {}
  ) => {
    const qp = new URLSearchParams();
    const status = "status" in overrides ? overrides.status : statusFilter;
    const nextSort = "sort" in overrides ? overrides.sort : sort;

    if (status) qp.set("status", status);
    if (user.role !== Role.ASSESSOR && assigneeFilter) qp.set("assignee", assigneeFilter);
    if (bursaryFilter) qp.set("bursary", bursaryFilter);
    if (yearFilter) qp.set("year", yearFilter);
    if (schoolFilter) qp.set("school", schoolFilter);
    if (fromParam) qp.set("from", fromParam);
    if (toParam) qp.set("to", toParam);
    if (nextSort) qp.set("sort", nextSort);

    const qs = qp.toString();
    return qs ? `/assessments?${qs}` : "/assessments";
  };

  const filterHref = (status?: AssessmentQueueStatus) =>
    hrefWith({ status: status ?? null });

  // CH-45 — the header link keeps whatever filters are active and only flips
  // the direction, so sorting never silently widens the list she is looking at.
  const sortHref = (next: SubmittedSort) => hrefWith({ sort: next });

  const anyFilterActive = Boolean(
    statusFilter || bursaryFilter || yearFilter || schoolFilter || fromParam || toParam
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-semibold text-primary-900">Assessments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Assessments due to be completed — every submitted application, with
          its assessment status. Applications-side admin stays on the{" "}
          <Link href="/queue" className="underline underline-offset-2">
            Applications
          </Link>{" "}
          queue.
        </p>
        </div>
        {/* Epic 18b — her mid-September ritual: lock every rolling-over
            assessment stored as complete, in one go. ADMIN only. */}
        {user.role === Role.ADMIN && (
          <BulkLockRolledOverButton eligibleCount={rolledOverLockable} />
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={filterHref(undefined)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !statusFilter
              ? "border-primary-900 bg-primary-900 text-white"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          All ({narrowed.length})
        </Link>
        {ALL_ASSESSMENT_QUEUE_STATUSES.map((status) => (
          <Link
            key={status}
            href={filterHref(status)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === status
                ? "border-primary-900 bg-primary-900 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {ASSESSMENT_QUEUE_STATUS_LABELS[status]} ({counts.get(status) ?? 0})
          </Link>
        ))}
      </div>

      {/* Epic 18b — her filter bar for aiming the September bulk lock:
          bursary status, round, school, submission date, plus the existing
          assignee. Assessment status is the chip row above. One GET form so
          they apply together; the chips and the sort header carry them back. */}
      <form
        method="GET"
        action="/assessments"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        {sort && <input type="hidden" name="sort" value={sort} />}

        <div className="flex flex-col gap-1">
          <label htmlFor="bursary" className="text-xs font-medium text-slate-500">
            Bursary account
          </label>
          <select
            id="bursary"
            name="bursary"
            defaultValue={bursaryFilter ?? ""}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
          >
            <option value="">Any</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="year" className="text-xs font-medium text-slate-500">
            Round
          </label>
          <select
            id="year"
            name="year"
            defaultValue={yearFilter ?? ""}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
          >
            <option value="">Any</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="school" className="text-xs font-medium text-slate-500">
            School
          </label>
          <select
            id="school"
            name="school"
            defaultValue={schoolFilter ?? ""}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
          >
            <option value="">Any</option>
            <option value="WHITGIFT">Whitgift</option>
            <option value="TRINITY">Trinity</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs font-medium text-slate-500">
            Submitted from
          </label>
          <input
            type="date"
            id="from"
            name="from"
            defaultValue={fromParam ?? ""}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs font-medium text-slate-500">
            Submitted to
          </label>
          <input
            type="date"
            id="to"
            name="to"
            defaultValue={toParam ?? ""}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
          />
        </div>

        {user.role !== Role.ASSESSOR && staff.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="assignee" className="text-xs font-medium text-slate-500">
              Assignee
            </label>
            <select
              id="assignee"
              name="assignee"
              defaultValue={assigneeFilter ?? ""}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
            >
              <option value="">Anyone</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Apply
        </button>
        {anyFilterActive && (
          <Link
            href="/assessments"
            className="h-8 rounded-md px-2 text-xs font-medium leading-8 text-slate-500 hover:text-slate-700"
          >
            Clear all
          </Link>
        )}
      </form>

      <p className="text-xs text-slate-500">
        Showing {visible.length} of {rows.length} assessments
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="No assessments here"
          description={
            anyFilterActive
              ? "Nothing matches these filters."
              : "There are no submitted applications awaiting assessment."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Child</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Round</th>
                <th className="px-4 py-3 font-medium">Assessment status</th>
                <th className="px-4 py-3 font-medium">Bursary account</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">
                  <Link
                    href={sortHref(
                      sort === "submitted_asc" ? "submitted_desc" : "submitted_asc"
                    )}
                    className="inline-flex items-center hover:text-primary-700"
                    aria-label={
                      sort === "submitted_asc"
                        ? "Sort by submitted date, newest first"
                        : "Sort by submitted date, oldest first"
                    }
                  >
                    Submitted
                    {sort === "submitted_asc" ? (
                      <ChevronUp className="ml-1 inline h-3 w-3" aria-hidden="true" />
                    ) : sort === "submitted_desc" ? (
                      <ChevronDown className="ml-1 inline h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ChevronsUpDown
                        className="ml-1 inline h-3 w-3 opacity-40"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((row: AssessmentQueueRow) => (
                <tr key={row.applicationId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-primary-900">
                    <Link
                      href={`/applications/${row.applicationId}/assessment`}
                      className="block hover:underline"
                    >
                      {row.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <Link
                      href={`/applications/${row.applicationId}/assessment`}
                      className="block"
                    >
                      {row.childName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.school === "TRINITY" ? "Trinity" : "Whitgift"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.academicYear ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <BursaryStatusBadge status={row.bursaryStatus} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.assigneeName ?? (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.submittedAt ? formatLondonDate(row.submittedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
