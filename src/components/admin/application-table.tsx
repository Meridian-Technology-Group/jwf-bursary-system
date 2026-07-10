"use client";

/**
 * Applications list data table.
 *
 * Client component using @tanstack/react-table for sorting/filtering. The list
 * is split into two tabs by application type:
 *   • New applications        — applicationType === "NEW"
 *   • Rolling-over bursaries  — applicationType === "ROLLING_OVER"
 *
 * The submission-date column is labelled "Submitted" on the New tab and
 * "Received" on the Rolling-over tab, matching the state model (§3).
 *
 * Lead applicant name + email are shown as first-class columns. The reveal is
 * audit-logged once per page load on the server (see the queue page), replacing
 * the old per-session "Show names" toggle.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
  Filter,
  X,
  Loader2,
  UserPlus,
  Mail,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatLondonDate } from "@/lib/datetime";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { ApplicationRowActions } from "@/components/admin/application-row-actions";
import type { CloseReasonOption } from "@/components/admin/close-application-dialog";
import { bulkAssignApplicationsAction } from "@/app/(admin)/applications/[id]/actions";
import { bulkReassessmentInviteFromApplicationsAction } from "@/app/(admin)/invitations/actions";

import type { ApplicationListItem } from "@/lib/db/queries/applications";
import {
  ALL_REVIEW_PHASES,
  matchesQueueFilters,
  type ReviewPhase,
} from "@/lib/applications/queue-filter";
import { REVIEW_PHASE_LABEL } from "@/lib/applications/review-phase-labels";
import type { School, Role } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoundOption = { id: string; academicYear: string; status: string };

type AssessorOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

/** Lead applicant name + email, revealed once (audited) at page load. */
export interface ApplicantNameEntry {
  id: string;
  leadApplicantName: string;
  leadApplicantEmail: string;
}

interface NameData {
  leadApplicantName: string;
  leadApplicantEmail: string;
}

/**
 * An `ApplicationListItem` plus its server-derived review phase (Item 1.1)
 * and effective submission deadline (Item 1.2) — both computed once in
 * `queue/page.tsx` via the shared `deriveReviewPhase` / `effectiveSubmissionDeadline`
 * helpers, the same ones the detail page uses, so every surface agrees.
 */
export type ApplicationListItemWithPhase = ApplicationListItem & {
  reviewPhase: ReviewPhase;
  /** The effective submission-by date (override ?? round default ?? round close). */
  effectiveDeadline: Date;
};

interface ApplicationRow extends ApplicationListItemWithPhase {
  names?: NameData;
}

type TabKey = "new" | "rolling";

interface ApplicationTableProps {
  applications: ApplicationListItemWithPhase[];
  /** Lead applicant names + emails, keyed by application id (always shown). */
  names: ApplicantNameEntry[];
  rounds: RoundOption[];
  /**
   * Assessors available for the bulk-assign dropdown. Only populated (and only
   * used) for ADMIN; empty for ASSESSOR/VIEWER.
   */
  assessors?: AssessorOption[];
  /**
   * The viewer's role. Selection + bulk toolbar are ADMIN-only — non-ADMIN
   * users get no checkbox column at all (no dead UI).
   */
  userRole?: Role;
  /** Seed the round dropdown from a drill-in URL (defaults to "all"). */
  initialRound?: string;
  /** Seed the school dropdown from a drill-in URL (defaults to "all"). */
  initialSchool?: string;
  /** Seed the "Received from" date input (Item 7.1), `YYYY-MM-DD`. */
  initialSubmittedFrom?: string;
  /** Seed the "Received to" date input (Item 7.1), `YYYY-MM-DD`. */
  initialSubmittedTo?: string;
  /** Seed the "Submission-by from" date input (Item 7.2), `YYYY-MM-DD`. */
  initialDeadlineFrom?: string;
  /** Seed the "Submission-by to" date input (Item 7.2), `YYYY-MM-DD`. */
  initialDeadlineTo?: string;
  /**
   * The current URL's query string (no leading `?`), as seen by the server
   * component. Used to preserve every other active filter when the
   * received-date or submission-by range navigates (Items 7.1/7.2) — avoids a
   * client-side `useSearchParams()` call, which would require a Suspense
   * boundary.
   */
  currentQueryString?: string;
  /**
   * When present, render a dismissible banner above the table describing the
   * server-side filter applied via the URL, with a "Clear filters" link.
   */
  activeFilter?: { label: string; clearHref: string };
  /**
   * Whether the `?reassessEligible=1` server filter is currently active. Drives
   * the "on" state of the Re-assessment eligible filter toggle (ADMIN only).
   */
  reassessEligibleActive?: boolean;
  /**
   * Active close reasons for the per-row Close dialog (item 4.1). Only
   * populated for ADMIN — the Close action is ADMIN-only (Story 2.1).
   */
  closeReasons?: CloseReasonOption[];
  /**
   * Academic year of the open round re-assessment invites would target, or null
   * when there is no open round. Surfaced in the bulk-invite confirmation.
   */
  reassessTargetRound?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SchoolBadge({ school }: { school: School }) {
  if (school === "WHITGIFT") {
    return (
      <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-800">
        Whitgift
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
      Trinity
    </span>
  );
}

// Colours loosely mirror the raw lifecycle badges in
// `components/shared/lifecycle-badges.tsx` (in-progress = amber/orange,
// complete = green), with QUALIFIES/DOES_NOT_QUALIFY recoloured to match their
// D-3 "Active"/"Closed" state-map wording rather than the legacy
// qualify/not-qualify implication.
const REVIEW_PHASE_BADGE_STYLES: Record<ReviewPhase, string> = {
  PRE_SUBMISSION: "bg-neutral-100 text-neutral-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  NOT_STARTED: "bg-orange-50 text-orange-700",
  PAUSED: "bg-yellow-50 text-yellow-700",
  COMPLETED: "bg-green-50 text-green-700",
  QUALIFIES: "bg-emerald-50 text-emerald-700",
  DOES_NOT_QUALIFY: "bg-neutral-100 text-neutral-500",
  // Item 2's unified terminal state — same neutral treatment as the legacy
  // DOES_NOT_QUALIFY row it converges with.
  CLOSED: "bg-neutral-100 text-neutral-500",
};

/** Status column badge (Item 1.1) — read-only; same wording as the detail page. */
function ReviewPhaseBadge({ phase }: { phase: ReviewPhase }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        REVIEW_PHASE_BADGE_STYLES[phase]
      )}
    >
      {REVIEW_PHASE_LABEL[phase]}
    </span>
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc")
    return <ChevronUp className="ml-1 inline h-3 w-3" aria-hidden="true" />;
  if (sorted === "desc")
    return <ChevronDown className="ml-1 inline h-3 w-3" aria-hidden="true" />;
  return (
    <ChevronsUpDown
      className="ml-1 inline h-3 w-3 opacity-40"
      aria-hidden="true"
    />
  );
}

function formatSubmittedDate(date: Date | null): React.ReactNode {
  if (!date) return <span className="text-slate-400">—</span>;
  const d = new Date(date);
  return (
    <span>
      {/* Absolute date in Europe/London so a just-past-midnight-London
          submission is not rolled back a day on a UTC runtime (§2.4). The
          relative line below is a duration (zone-agnostic). */}
      <span className="block text-slate-700">{formatLondonDate(d)}</span>
      <span className="block text-xs text-slate-400">
        {formatDistanceToNow(d, { addSuffix: true })}
      </span>
    </span>
  );
}

/**
 * Deadline column (Item 1.2). `effectiveDeadline` is typed non-null (the D-1
 * chain always resolves to at least `round.closeDate`), so the em-dash below
 * is a defensive fallback only — not an expected path.
 */
function formatDeadlineDate(date: Date | null | undefined): React.ReactNode {
  if (!date) return <span className="text-slate-400">—</span>;
  return <span className="text-slate-700">{formatLondonDate(new Date(date))}</span>;
}

// ─── Bulk-action toolbar ────────────────────────────────────────────────────────

const BULK_UNASSIGNED_VALUE = "__unassigned__";

type BulkFeedback = { kind: "success" | "error"; message: string } | null;

interface BulkAction {
  id: string;
  render: (ctx: {
    selectedIds: string[];
    isPending: boolean;
    run: (fn: () => Promise<void>) => void;
  }) => React.ReactNode;
}

function ReassessmentBulkAction({
  selectedIds,
  isPending,
  run,
  targetRound,
  targetRoundId,
  onFeedback,
  onActionComplete,
}: {
  selectedIds: string[];
  isPending: boolean;
  run: (fn: () => Promise<void>) => void;
  targetRound: string | null;
  targetRoundId: string | null;
  onFeedback: (feedback: BulkFeedback) => void;
  onActionComplete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const count = selectedIds.length;

  const handleConfirm = () => {
    setOpen(false);
    run(async () => {
      const result = await bulkReassessmentInviteFromApplicationsAction(
        selectedIds,
        targetRoundId
      );
      if (result.sent > 0 || result.failed === 0) {
        onFeedback({
          kind: result.failed > 0 ? "error" : "success",
          message: `Invited ${result.sent} · skipped ${result.skipped} · failed ${result.failed}${
            result.targetRound ? ` · → ${result.targetRound}` : ""
          }`,
        });
        if (result.sent > 0) onActionComplete();
      } else {
        onFeedback({
          kind: "error",
          message:
            result.errors[0] ??
            `Invited ${result.sent} · skipped ${result.skipped} · failed ${result.failed}`,
        });
      }
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending || count === 0}
        onClick={() => setOpen(true)}
        className="h-8 shrink-0 whitespace-nowrap border-primary-200 bg-white text-xs text-slate-600"
      >
        {isPending ? (
          <Loader2
            className="mr-1.5 h-3 w-3 shrink-0 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Mail className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        Send re-assessment invite
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send re-assessment invites</DialogTitle>
            <DialogDescription>
              Send re-assessment invites to {count} selected holder
              {count === 1 ? "" : "s"}
              {targetRound ? ` for round ${targetRound}` : ""}?
              {!targetRound && (
                <span className="mt-1 block text-amber-600">
                  There is no open round to invite into — nothing will be sent.
                </span>
              )}
              <span className="mt-2 block text-xs text-slate-500">
                Selections without an eligible bursary holder are skipped.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface BulkToolbarProps {
  selectedIds: string[];
  assessors: AssessorOption[];
  reassessTargetRound: string | null;
  reassessTargetRoundId: string | null;
  onClear: () => void;
  onActionComplete: () => void;
  onFeedback: (feedback: BulkFeedback) => void;
}

function BulkToolbar({
  selectedIds,
  assessors,
  reassessTargetRound,
  reassessTargetRoundId,
  onClear,
  onActionComplete,
  onFeedback,
}: BulkToolbarProps) {
  const [isPending, startTransition] = useTransition();

  const count = selectedIds.length;

  const run = React.useCallback(
    (fn: () => Promise<void>) => {
      onFeedback(null);
      startTransition(() => {
        void fn();
      });
    },
    [onFeedback]
  );

  const actions: BulkAction[] = [
    {
      id: "assign-assessor",
      render: ({ selectedIds, isPending, run }) => (
        <Select
          disabled={isPending || selectedIds.length === 0}
          onValueChange={(value) => {
            const assessorId = value === BULK_UNASSIGNED_VALUE ? null : value;
            run(async () => {
              const result = await bulkAssignApplicationsAction(
                selectedIds,
                assessorId
              );
              if (result.success) {
                onFeedback({
                  kind: "success",
                  message: `Assigned ${result.updated} application${
                    result.updated === 1 ? "" : "s"
                  }.`,
                });
                onActionComplete();
              } else {
                onFeedback({
                  kind: "error",
                  message: result.error ?? "Bulk assignment failed.",
                });
              }
            });
          }}
        >
          <SelectTrigger className="h-8 w-[190px] shrink-0 border-primary-200 bg-white text-xs">
            {isPending ? (
              <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-400">
                <Loader2
                  className="h-3 w-3 shrink-0 animate-spin"
                  aria-hidden="true"
                />
                Saving…
              </span>
            ) : (
              <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Assign assessor
              </span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BULK_UNASSIGNED_VALUE}>
              <span className="text-slate-400 italic">Unassigned</span>
            </SelectItem>
            {assessors.map((assessor) => {
              const name =
                `${assessor.firstName ?? ""} ${
                  assessor.lastName ?? ""
                }`.trim() || assessor.id;
              return (
                <SelectItem key={assessor.id} value={assessor.id}>
                  {name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "reassessment-invite",
      render: ({ selectedIds, isPending, run }) => (
        <ReassessmentBulkAction
          selectedIds={selectedIds}
          isPending={isPending}
          run={run}
          targetRound={reassessTargetRound}
          targetRoundId={reassessTargetRoundId}
          onFeedback={onFeedback}
          onActionComplete={onActionComplete}
        />
      ),
    },
  ];

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-primary-200 bg-primary-50/80 px-4 py-2.5 shadow-sm backdrop-blur">
      <span className="text-sm font-medium text-primary-900">
        {count} selected
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
        onClick={onClear}
        disabled={isPending}
      >
        <X className="mr-1 h-3 w-3" aria-hidden="true" />
        Clear
      </Button>

      <div className="h-5 w-px bg-primary-200" aria-hidden="true" />

      {actions.map((action) => (
        <React.Fragment key={action.id}>
          {action.render({ selectedIds, isPending, run })}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApplicationTable({
  applications,
  names,
  rounds,
  assessors = [],
  userRole,
  initialRound,
  initialSchool,
  initialSubmittedFrom,
  initialSubmittedTo,
  initialDeadlineFrom,
  initialDeadlineTo,
  currentQueryString,
  activeFilter,
  reassessEligibleActive = false,
  reassessTargetRound = null,
  closeReasons = [],
}: ApplicationTableProps) {
  const router = useRouter();

  const bulkEnabled = userRole === "ADMIN";

  // Filter state — seeded from drill-in props when present, else current defaults.
  const [selectedRound, setSelectedRound] = React.useState<string>(
    initialRound ?? "all"
  );
  const [selectedSchool, setSelectedSchool] = React.useState<string>(
    initialSchool ?? "all"
  );
  // Status multi-select (Item 1.3) — client-side only, composes (AND) with the
  // other filters below. Independent of the `?status=` server drill-in.
  const [selectedStatuses, setSelectedStatuses] = React.useState<ReviewPhase[]>(
    []
  );
  const [searchText, setSearchText] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<TabKey>("new");

  // Received-date range (Item 7.1) — server-side; changing either date
  // navigates (router.replace) so `listApplications` re-runs with the new
  // bounds. Seeded from the URL so the inputs reflect whatever was actually
  // applied (an invalid hand-edited range renders blank — see queue/page.tsx).
  const [submittedFrom, setSubmittedFrom] = React.useState(
    initialSubmittedFrom ?? ""
  );
  const [submittedTo, setSubmittedTo] = React.useState(
    initialSubmittedTo ?? ""
  );
  const [receivedRangeError, setReceivedRangeError] = React.useState<
    string | null
  >(null);

  // Submission-by (deadline) range (Item 7.2) — same server-side navigation
  // pattern as the received-date range above, independently clearable.
  const [deadlineFrom, setDeadlineFrom] = React.useState(
    initialDeadlineFrom ?? ""
  );
  const [deadlineTo, setDeadlineTo] = React.useState(initialDeadlineTo ?? "");
  const [deadlineRangeError, setDeadlineRangeError] = React.useState<
    string | null
  >(null);

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkFeedback, setBulkFeedback] = React.useState<BulkFeedback>(null);

  // Name map keyed by application id — always populated (revealed on the server).
  const nameMap = React.useMemo(() => {
    const map = new Map<string, NameData>();
    for (const entry of names) {
      map.set(entry.id, {
        leadApplicantName: entry.leadApplicantName,
        leadApplicantEmail: entry.leadApplicantEmail,
      });
    }
    return map;
  }, [names]);

  // Clear selection whenever a filter OR the tab changes so we never act on rows
  // that have scrolled out of the visible view.
  React.useEffect(() => {
    setRowSelection({});
    setBulkFeedback(null);
  }, [selectedRound, selectedSchool, selectedStatuses, searchText, activeTab]);

  // Derived rows with names merged in.
  const rows: ApplicationRow[] = React.useMemo(() => {
    return applications.map((app) => ({
      ...app,
      names: nameMap.get(app.id),
    }));
  }, [applications, nameMap]);

  // Shared (round / school / status / search) filtering — applied before the
  // tab split, so composing with the tab is automatic. The received-date
  // range (7.1) is NOT filtered here — it's applied server-side (see
  // `applyReceivedDateFilter` below), so these rows are already scoped to it.
  const filteredRows = React.useMemo(() => {
    return rows.filter((row) =>
      matchesQueueFilters(
        {
          round: row.round,
          school: row.school,
          reviewPhase: row.reviewPhase,
          reference: row.reference,
          leadApplicantName: row.names?.leadApplicantName,
          leadApplicantEmail: row.names?.leadApplicantEmail,
        },
        {
          roundId: selectedRound,
          school: selectedSchool,
          statuses: selectedStatuses,
          searchText,
        }
      )
    );
  }, [rows, selectedRound, selectedSchool, selectedStatuses, searchText]);

  function toggleStatus(phase: ReviewPhase, checked: boolean) {
    setSelectedStatuses((prev) =>
      checked ? [...prev, phase] : prev.filter((p) => p !== phase)
    );
  }

  // Received-date range (Item 7.1) — a real navigation (unlike round/school/
  // status, which re-filter the already-fetched rows client-side) so
  // `listApplications` re-runs server-side with the new bounds. Preserves
  // every other current query param (roundId/school/status/reassessEligible/
  // deadlineFrom/deadlineTo etc.) so this filter composes without clobbering
  // the others, and is clearable independently of the deadline range below.
  function applyReceivedDateFilter(nextFrom: string, nextTo: string) {
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setReceivedRangeError(
        "'Received from' must be on or before 'Received to'."
      );
      return;
    }
    setReceivedRangeError(null);
    const nextParams = new URLSearchParams(currentQueryString ?? "");
    if (nextFrom) nextParams.set("submittedFrom", nextFrom);
    else nextParams.delete("submittedFrom");
    if (nextTo) nextParams.set("submittedTo", nextTo);
    else nextParams.delete("submittedTo");
    router.replace(`/queue?${nextParams.toString()}`);
  }

  // Submission-by (deadline) range (Item 7.2) — same server-side navigation
  // pattern, independently clearable from the received-date range above.
  function applyDeadlineRangeFilter(nextFrom: string, nextTo: string) {
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setDeadlineRangeError(
        "'Submission-by from' must be on or before 'Submission-by to'."
      );
      return;
    }
    setDeadlineRangeError(null);
    const nextParams = new URLSearchParams(currentQueryString ?? "");
    if (nextFrom) nextParams.set("deadlineFrom", nextFrom);
    else nextParams.delete("deadlineFrom");
    if (nextTo) nextParams.set("deadlineTo", nextTo);
    else nextParams.delete("deadlineTo");
    router.replace(`/queue?${nextParams.toString()}`);
  }

  // Tab split by application type.
  const { newRows, rollingRows } = React.useMemo(() => {
    const newRows: ApplicationRow[] = [];
    const rollingRows: ApplicationRow[] = [];
    for (const row of filteredRows) {
      if (row.applicationType === "ROLLING_OVER") rollingRows.push(row);
      else newRows.push(row);
    }
    return { newRows, rollingRows };
  }, [filteredRows]);

  const visibleRows = activeTab === "new" ? newRows : rollingRows;
  const dateHeader = activeTab === "new" ? "Submitted" : "Received";

  // Column definitions — rebuilt when the tab changes (date header label).
  const columnHelper = createColumnHelper<ApplicationRow>();

  const columns = React.useMemo(() => {
    const base = [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select all applications"
          />
        ),
        cell: (info) => (
          <Checkbox
            checked={info.row.getIsSelected()}
            onCheckedChange={(value) => info.row.toggleSelected(!!value)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select application"
          />
        ),
        enableSorting: false,
      }),
      columnHelper.accessor("reference", {
        header: "Reference",
        cell: (info) => (
          <span className="font-mono text-sm font-medium text-slate-800">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.round.academicYear, {
        id: "round",
        header: "Round",
        cell: (info) => (
          <span className="text-slate-700">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("school", {
        header: "School",
        cell: (info) => <SchoolBadge school={info.getValue()} />,
      }),
      columnHelper.accessor("reviewPhase", {
        header: "Status",
        cell: (info) => <ReviewPhaseBadge phase={info.getValue()} />,
      }),
      columnHelper.display({
        id: "leadApplicant",
        header: "Lead applicant",
        cell: (info) =>
          info.row.original.names?.leadApplicantName ? (
            <span className="text-slate-700">
              {info.row.original.names.leadApplicantName}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      }),
      columnHelper.display({
        id: "email",
        header: "Email",
        cell: (info) =>
          info.row.original.names?.leadApplicantEmail ? (
            <a
              href={`mailto:${info.row.original.names.leadApplicantEmail}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary-700 hover:underline"
            >
              {info.row.original.names.leadApplicantEmail}
            </a>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      }),
      columnHelper.accessor("submittedAt", {
        header: dateHeader,
        cell: (info) => formatSubmittedDate(info.getValue()),
        sortingFn: (a, b) => {
          const dateA = a.original.submittedAt
            ? new Date(a.original.submittedAt).getTime()
            : 0;
          const dateB = b.original.submittedAt
            ? new Date(b.original.submittedAt).getTime()
            : 0;
          return dateA - dateB;
        },
      }),
      columnHelper.accessor("effectiveDeadline", {
        header: "Submission-by",
        cell: (info) => formatDeadlineDate(info.getValue()),
        sortingFn: (a, b) => {
          const dateA = a.original.effectiveDeadline
            ? new Date(a.original.effectiveDeadline).getTime()
            : 0;
          const dateB = b.original.effectiveDeadline
            ? new Date(b.original.effectiveDeadline).getTime()
            : 0;
          return dateA - dateB;
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/applications/${row.id}`);
                }}
              >
                <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                Open
              </Button>
              <ApplicationRowActions
                applicationId={row.id}
                reference={row.reference}
                formStatus={row.formStatus}
                assessmentStatus={row.assessmentStatus}
                outcome={row.outcome}
                closedAt={row.closedAt}
                isAdmin={userRole === "ADMIN"}
                closeReasons={closeReasons}
              />
            </div>
          );
        },
      }),
    ];

    // Drop the leading select column for non-ADMIN viewers (no bulk actions).
    return bulkEnabled ? base : base.filter((col) => col.id !== "select");
  }, [columnHelper, router, bulkEnabled, dateHeader]);

  const table = useReactTable({
    data: visibleRows,
    columns,
    state: { sorting, columnFilters, rowSelection },
    enableRowSelection: bulkEnabled,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedIds = React.useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  );

  const handleClearSelection = React.useCallback(() => {
    setRowSelection({});
  }, []);

  const handleBulkComplete = React.useCallback(() => {
    setRowSelection({});
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-4">
      {/* Active drill-in filter banner */}
      {activeFilter && (
        <Alert className="flex items-center justify-between gap-3 border-primary-200 bg-primary-50/60 py-2.5 text-primary-900">
          <span className="flex items-center gap-2 text-sm">
            <Filter
              className="h-4 w-4 shrink-0 text-primary-700"
              aria-hidden="true"
            />
            <span>
              <span className="font-medium">Showing:</span> {activeFilter.label}
            </span>
          </span>
          <Link
            href={activeFilter.clearHref}
            className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white px-2.5 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear filters
          </Link>
        </Alert>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-50 px-4 py-3 border border-neutral-200">
        <Select value={selectedRound} onValueChange={setSelectedRound}>
          <SelectTrigger className="h-9 w-[160px] border-neutral-200 bg-white text-sm">
            <SelectValue placeholder="All rounds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rounds</SelectItem>
            {rounds.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.academicYear}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSchool} onValueChange={setSelectedSchool}>
          <SelectTrigger className="h-9 w-[140px] border-neutral-200 bg-white text-sm">
            <SelectValue placeholder="All schools" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schools</SelectItem>
            <SelectItem value="WHITGIFT">Whitgift</SelectItem>
            <SelectItem value="TRINITY">Trinity</SelectItem>
          </SelectContent>
        </Select>

        {/* Status multi-select (Item 1.3) — client-side, composes with the rest */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 shrink-0 whitespace-nowrap border-neutral-200 bg-white text-sm",
                selectedStatuses.length > 0
                  ? "border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100"
                  : "text-slate-600 hover:bg-neutral-50"
              )}
            >
              <Filter className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Status
              {selectedStatuses.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary-200 px-1.5 text-[11px] text-primary-900">
                  {selectedStatuses.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {ALL_REVIEW_PHASES.map((phase) => (
              <DropdownMenuCheckboxItem
                key={phase}
                checked={selectedStatuses.includes(phase)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => toggleStatus(phase, checked)}
              >
                {REVIEW_PHASE_LABEL[phase]}
              </DropdownMenuCheckboxItem>
            ))}
            {selectedStatuses.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSelectedStatuses([])}>
                  Clear status filter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Re-assessment-eligible toggle (ADMIN only, URL-driven server filter) */}
        {bulkEnabled && (
          <Button
            variant="outline"
            size="sm"
            aria-pressed={reassessEligibleActive}
            onClick={() =>
              router.push(
                reassessEligibleActive ? "/queue" : "/queue?reassessEligible=1"
              )
            }
            className={cn(
              "h-9 shrink-0 whitespace-nowrap border-neutral-200 bg-white text-sm",
              reassessEligibleActive
                ? "border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100"
                : "text-slate-600 hover:bg-neutral-50"
            )}
          >
            <RefreshCw
              className="mr-1.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            Re-assessment eligible
          </Button>
        )}

        <Input
          placeholder="Search name, email or reference…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="h-9 w-[240px] border-neutral-200 bg-white text-sm placeholder:text-slate-400"
        />

        {/* Received-date range (Item 7.1) — server-side, navigates on change */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">Received</span>
            <Input
              type="date"
              aria-label="Received from"
              value={submittedFrom}
              max={submittedTo || undefined}
              onChange={(e) => {
                setSubmittedFrom(e.target.value);
                applyReceivedDateFilter(e.target.value, submittedTo);
              }}
              className="h-9 w-[150px] border-neutral-200 bg-white text-sm"
            />
            <span className="text-xs text-slate-400" aria-hidden="true">
              –
            </span>
            <Input
              type="date"
              aria-label="Received to"
              value={submittedTo}
              min={submittedFrom || undefined}
              onChange={(e) => {
                setSubmittedTo(e.target.value);
                applyReceivedDateFilter(submittedFrom, e.target.value);
              }}
              className="h-9 w-[150px] border-neutral-200 bg-white text-sm"
            />
          </div>
          {receivedRangeError && (
            <span role="alert" className="text-xs text-red-600">
              {receivedRangeError}
            </span>
          )}
        </div>

        {/* Submission-by (deadline) range (Item 7.2) — server-side, independently clearable */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">
              Submission-by
            </span>
            <Input
              type="date"
              aria-label="Submission-by from"
              value={deadlineFrom}
              max={deadlineTo || undefined}
              onChange={(e) => {
                setDeadlineFrom(e.target.value);
                applyDeadlineRangeFilter(e.target.value, deadlineTo);
              }}
              className="h-9 w-[150px] border-neutral-200 bg-white text-sm"
            />
            <span className="text-xs text-slate-400" aria-hidden="true">
              –
            </span>
            <Input
              type="date"
              aria-label="Submission-by to"
              value={deadlineTo}
              min={deadlineFrom || undefined}
              onChange={(e) => {
                setDeadlineTo(e.target.value);
                applyDeadlineRangeFilter(deadlineFrom, e.target.value);
              }}
              className="h-9 w-[150px] border-neutral-200 bg-white text-sm"
            />
          </div>
          {deadlineRangeError && (
            <span role="alert" className="text-xs text-red-600">
              {deadlineRangeError}
            </span>
          )}
        </div>
      </div>

      {/* Section tabs: New applications vs Rolling-over bursaries */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
      >
        <TabsList>
          <TabsTrigger value="new">
            New applications
            <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 text-xs text-slate-600">
              {newRows.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="rolling">
            Rolling-over bursaries
            <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 text-xs text-slate-600">
              {rollingRows.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Bulk-action toolbar — ADMIN only, shown when ≥1 row is selected */}
      {bulkEnabled && selectedIds.length > 0 && (
        <BulkToolbar
          selectedIds={selectedIds}
          assessors={assessors}
          reassessTargetRound={reassessTargetRound}
          reassessTargetRoundId={selectedRound !== "all" ? selectedRound : null}
          onClear={handleClearSelection}
          onActionComplete={handleBulkComplete}
          onFeedback={setBulkFeedback}
        />
      )}

      {bulkEnabled && bulkFeedback && (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm font-medium",
            bulkFeedback.kind === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-600"
          )}
        >
          <span>{bulkFeedback.message}</span>
          <button
            type="button"
            onClick={() => setBulkFeedback(null)}
            className="text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss message"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Table — horizontal scroll wrapper for mobile */}
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <div className="min-w-[720px] md:min-w-0 rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b border-neutral-200 hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {header.isPlaceholder ? null : (
                          <span
                            className={cn(
                              canSort
                                ? "cursor-pointer select-none hover:text-slate-800 flex items-center"
                                : ""
                            )}
                            onClick={
                              canSort
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {canSort && <SortIcon sorted={sorted} />}
                          </span>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium text-slate-500">
                        {activeTab === "new"
                          ? "No new applications match the current filters"
                          : "No rolling-over bursaries match the current filters"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Try adjusting or clearing the filters above
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer border-b border-neutral-100 py-3 hover:bg-neutral-50 transition-colors"
                    onClick={() => router.push(`/applications/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Row count */}
      <p className="text-xs text-slate-400">
        Showing {table.getRowModel().rows.length} of {visibleRows.length}{" "}
        {activeTab === "new"
          ? `new application${visibleRows.length === 1 ? "" : "s"}`
          : `rolling-over bursar${visibleRows.length === 1 ? "y" : "ies"}`}
      </p>
    </div>
  );
}
