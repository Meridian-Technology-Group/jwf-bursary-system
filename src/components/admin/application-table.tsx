"use client";

/**
 * Application queue data table.
 *
 * Client component using @tanstack/react-table for sorting/filtering.
 * Supports per-session name reveal (calls API, writes audit log).
 */

import * as React from "react";
import Link from "next/link";
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
  MoreHorizontal,
  Eye,
  AlertTriangle,
  Filter,
  X,
  Loader2,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

import { bulkAssignApplicationsAction } from "@/app/(admin)/applications/[id]/actions";

import type {
  ApplicationListItem,
  SecondParentIndicator,
} from "@/lib/db/queries/applications";
import type { ApplicationStatus, School, Role } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoundOption = { id: string; academicYear: string; status: string };

type AssessorOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

interface NameData {
  childName: string;
  leadApplicantName: string;
}

interface ApplicationRow extends ApplicationListItem {
  names?: NameData;
}

interface ApplicationTableProps {
  applications: ApplicationListItem[];
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
  /** Seed the status multi-select from a drill-in URL (defaults to none). */
  initialStatuses?: ApplicationStatus[];
  /**
   * When present, render a dismissible banner above the table describing the
   * server-side filter applied via the URL, with a "Clear filters" link.
   */
  activeFilter?: { label: string; clearHref: string };
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

// Dual-parent (PR 5): compact second-parent indicator for the queue. Shows
// nothing for single-parent applications (the common case), a coloured pill
// otherwise. "Awaiting" warns the assessor the application is not yet gated
// ready.
function SecondParentBadge({
  indicator,
}: {
  indicator: SecondParentIndicator;
}) {
  if (indicator === "NONE") {
    return <span className="text-slate-300">—</span>;
  }
  const config: Record<
    Exclude<SecondParentIndicator, "NONE">,
    { label: string; className: string }
  > = {
    SUBMITTED: {
      label: "Submitted",
      className: "bg-green-50 text-green-700 border-green-200",
    },
    OVERRIDE: {
      label: "Override",
      className: "bg-slate-100 text-slate-600 border-slate-200",
    },
    AWAITING: {
      label: "Awaiting",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
  };
  const { label, className } = config[indicator];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
      title="Second parent (dual-parent application)"
    >
      {label}
    </span>
  );
}

function SortIcon({
  sorted,
}: {
  sorted: false | "asc" | "desc";
}) {
  if (sorted === "asc")
    return <ChevronUp className="ml-1 inline h-3 w-3" aria-hidden="true" />;
  if (sorted === "desc")
    return <ChevronDown className="ml-1 inline h-3 w-3" aria-hidden="true" />;
  return (
    <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" aria-hidden="true" />
  );
}

function formatSubmittedDate(date: Date | null): React.ReactNode {
  if (!date) return <span className="text-slate-400">—</span>;
  const d = new Date(date);
  return (
    <span>
      <span className="block text-slate-700">{format(d, "d MMM yyyy")}</span>
      <span className="block text-xs text-slate-400">
        {formatDistanceToNow(d, { addSuffix: true })}
      </span>
    </span>
  );
}

// Map Prisma ApplicationStatus to StatusBadge's accepted values
function mapStatus(
  status: ApplicationStatus
): React.ComponentProps<typeof StatusBadge>["status"] {
  const map: Record<
    ApplicationStatus,
    React.ComponentProps<typeof StatusBadge>["status"]
  > = {
    PRE_SUBMISSION: "DRAFT",
    SUBMITTED: "SUBMITTED",
    NOT_STARTED: "SUBMITTED",
    PAUSED: "PAUSED",
    COMPLETED: "IN_REVIEW",
    QUALIFIES: "QUALIFIES",
    DOES_NOT_QUALIFY: "DOES_NOT_QUALIFY",
  };
  return map[status] ?? "DRAFT";
}

// ─── Status multi-select popover ──────────────────────────────────────────────

const ALL_STATUSES: ApplicationStatus[] = [
  "PRE_SUBMISSION",
  "SUBMITTED",
  "NOT_STARTED",
  "PAUSED",
  "COMPLETED",
  "QUALIFIES",
  "DOES_NOT_QUALIFY",
];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PRE_SUBMISSION: "Pre-Submission",
  SUBMITTED: "Submitted",
  NOT_STARTED: "Not Started",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  QUALIFIES: "Qualifies",
  DOES_NOT_QUALIFY: "Does Not Qualify",
};

interface StatusFilterProps {
  selected: ApplicationStatus[];
  onChange: (statuses: ApplicationStatus[]) => void;
}

function StatusFilter({ selected, onChange }: StatusFilterProps) {
  const toggle = (status: ApplicationStatus) => {
    if (selected.includes(status)) {
      onChange(selected.filter((s) => s !== status));
    } else {
      onChange([...selected, status]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-neutral-200 bg-white text-slate-600 hover:bg-neutral-50">
          Status
          {selected.length > 0 && (
            <Badge className="ml-1.5 h-4 w-4 rounded-full p-0 text-[10px] flex items-center justify-center bg-primary-700 text-white">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <div className="space-y-1">
          {ALL_STATUSES.map((status) => (
            <label
              key={status}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-neutral-50"
            >
              <Checkbox
                checked={selected.includes(status)}
                onCheckedChange={() => toggle(status)}
              />
              <span className="text-sm text-slate-700">
                {STATUS_LABELS[status]}
              </span>
            </label>
          ))}
          {selected.length > 0 && (
            <div className="border-t pt-1 mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-slate-500"
                onClick={() => onChange([])}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Bulk-action toolbar ────────────────────────────────────────────────────────

// Sentinel value for the "Unassigned" option in the bulk-assign Select
// (mirrors AssignAssessorSelect — Radix Select cannot use an empty string).
const BULK_UNASSIGNED_VALUE = "__unassigned__";

type BulkFeedback = { kind: "success" | "error"; message: string } | null;

/**
 * Descriptor for a bulk action. Keeping these in an array makes it cheap to add
 * further actions later (e.g. bulk status change, export-selected) — each one
 * renders its own control inside the toolbar. For now there is a single action:
 * Assign assessor (which also covers Unassign via the sentinel option).
 */
interface BulkAction {
  id: string;
  /** Renders the action's control. */
  render: (ctx: {
    selectedIds: string[];
    isPending: boolean;
    run: (fn: () => Promise<void>) => void;
  }) => React.ReactNode;
}

interface BulkToolbarProps {
  selectedIds: string[];
  assessors: AssessorOption[];
  onClear: () => void;
  /**
   * Called after a successful action so the parent can refresh + clear the
   * selection. Note: clearing unmounts this toolbar, so success feedback is
   * surfaced by the parent (which outlives the toolbar), not here.
   */
  onActionComplete: () => void;
  /** Report feedback up so it survives the toolbar unmounting on success. */
  onFeedback: (feedback: BulkFeedback) => void;
}

function BulkToolbar({
  selectedIds,
  assessors,
  onClear,
  onActionComplete,
  onFeedback,
}: BulkToolbarProps) {
  const [isPending, startTransition] = useTransition();

  const count = selectedIds.length;

  // Wraps an async action in a transition. Shared by every BulkAction.
  const run = React.useCallback(
    (fn: () => Promise<void>) => {
      onFeedback(null);
      startTransition(() => {
        void fn();
      });
    },
    [onFeedback]
  );

  // The set of available bulk actions. Extend this array to add more.
  const actions: BulkAction[] = [
    {
      id: "assign-assessor",
      render: ({ selectedIds, isPending, run }) => (
        <Select
          disabled={isPending || selectedIds.length === 0}
          onValueChange={(value) => {
            const assessorId =
              value === BULK_UNASSIGNED_VALUE ? null : value;
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
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
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
  rounds,
  assessors = [],
  userRole,
  initialRound,
  initialSchool,
  initialStatuses,
  activeFilter,
}: ApplicationTableProps) {
  const router = useRouter();

  // Selection + bulk actions are ADMIN-only. Non-ADMIN users (ASSESSOR/VIEWER)
  // have no bulk actions available, so we hide the checkbox column and toolbar
  // entirely rather than show a dead UI.
  const bulkEnabled = userRole === "ADMIN";

  // Filter state — seeded from drill-in props when present, else current defaults.
  const [selectedRound, setSelectedRound] = React.useState<string>(
    initialRound ?? "all"
  );
  const [selectedSchool, setSelectedSchool] = React.useState<string>(
    initialSchool ?? "all"
  );
  const [selectedStatuses, setSelectedStatuses] = React.useState<
    ApplicationStatus[]
  >(initialStatuses ?? []);
  const [searchText, setSearchText] = React.useState("");

  // Name reveal state
  const [namesRevealed, setNamesRevealed] = React.useState(false);
  const [namesLoading, setNamesLoading] = React.useState(false);
  const [nameMap, setNameMap] = React.useState<
    Map<string, NameData>
  >(new Map());

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkFeedback, setBulkFeedback] = React.useState<BulkFeedback>(null);

  // Selection coherence: clear the selection whenever any filter changes so we
  // never act on rows that have scrolled out of the filtered view. Keeping
  // hidden rows selected would let a bulk action hit applications the user can
  // no longer see. Simplest safe behaviour: reset on filter change.
  React.useEffect(() => {
    setRowSelection({});
    setBulkFeedback(null);
  }, [selectedRound, selectedSchool, selectedStatuses, searchText]);

  // Derived rows with optional names merged in
  const rows: ApplicationRow[] = React.useMemo(() => {
    return applications.map((app) => ({
      ...app,
      names: nameMap.get(app.id),
    }));
  }, [applications, nameMap]);

  // Client-side filtering
  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (selectedRound !== "all" && row.round.id !== selectedRound)
        return false;
      if (selectedSchool !== "all" && row.school !== selectedSchool)
        return false;
      if (
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes(row.status)
      )
        return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const matchRef = row.reference.toLowerCase().includes(q);
        const matchChild = row.names?.childName.toLowerCase().includes(q);
        const matchLead = row.names?.leadApplicantName
          .toLowerCase()
          .includes(q);
        if (!matchRef && !matchChild && !matchLead) return false;
      }
      return true;
    });
  }, [rows, selectedRound, selectedSchool, selectedStatuses, searchText]);

  // Handle name reveal toggle
  const handleNamesToggle = async (checked: boolean) => {
    if (!checked) {
      setNamesRevealed(false);
      return;
    }

    setNamesLoading(true);
    try {
      const ids = applications.map((a) => a.id);
      const params = new URLSearchParams();
      ids.forEach((id) => params.append("applicationIds[]", id));

      const res = await fetch(`/api/applications/names?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch names");

      const data = (await res.json()) as Array<{
        id: string;
        childName: string;
        leadApplicantName: string;
      }>;

      const map = new Map<string, NameData>();
      data.forEach((item) => {
        map.set(item.id, {
          childName: item.childName,
          leadApplicantName: item.leadApplicantName,
        });
      });

      setNameMap(map);
      setNamesRevealed(true);
    } catch (err) {
      console.error("Name reveal failed:", err);
    } finally {
      setNamesLoading(false);
    }
  };

  // Column definitions
  const columnHelper = createColumnHelper<ApplicationRow>();

  const columns = React.useMemo(() => {
    const base = [
      // Leading selection column (ADMIN only). The header checkbox selects /
      // deselects ALL currently-filtered rows (table.data === filteredRows), and
      // shows an indeterminate state when only some are selected.
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
            onCheckedChange={(value) =>
              table.toggleAllRowsSelected(!!value)
            }
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
      columnHelper.accessor("school", {
        header: "School",
        cell: (info) => <SchoolBadge school={info.getValue()} />,
      }),
      columnHelper.accessor("submittedAt", {
        header: "Submitted",
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
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={mapStatus(info.getValue())} />,
      }),
      columnHelper.accessor("secondParent", {
        header: "2nd Parent",
        cell: (info) => <SecondParentBadge indicator={info.getValue()} />,
        enableSorting: false,
      }),
      columnHelper.accessor("entryYear", {
        header: "Entry Year",
        cell: (info) =>
          info.getValue() ? (
            <span className="text-slate-700">{info.getValue()}</span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      }),
    ];

    if (namesRevealed) {
      base.push(
        columnHelper.display({
          id: "childName",
          header: "Child Name",
          cell: (info) =>
            info.row.original.names?.childName ? (
              <span className="text-slate-700">
                {info.row.original.names.childName}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            ),
        }) as typeof base[0],
        columnHelper.display({
          id: "leadApplicant",
          header: "Lead Applicant",
          cell: (info) =>
            info.row.original.names?.leadApplicantName ? (
              <span className="text-slate-700">
                {info.row.original.names.leadApplicantName}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            ),
        }) as typeof base[0]
      );
    }

    base.push(
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const id = info.row.original.id;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/applications/${id}`);
                }}
              >
                <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                Open
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="More options"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => router.push(`/applications/${id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }) as typeof base[0]
    );

    // Drop the leading select column for non-ADMIN viewers (no bulk actions).
    return bulkEnabled ? base : base.filter((col) => col.id !== "select");
  }, [namesRevealed, columnHelper, router, bulkEnabled]);

  const table = useReactTable({
    data: filteredRows,
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

  // Selected application ids (stable across re-renders via getRowId === app id).
  // Reading from rowSelection keys is sufficient because getRowId uses the id.
  const selectedIds = React.useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  );

  const handleClearSelection = React.useCallback(() => {
    setRowSelection({});
  }, []);

  // After a successful bulk action: clear selection and refresh server data.
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
            <Filter className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
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
        {/* Round selector */}
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

        {/* School filter */}
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

        {/* Status filter */}
        <StatusFilter
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
        />

        {/* Search */}
        <Input
          placeholder="Search reference…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="h-9 w-[200px] border-neutral-200 bg-white text-sm placeholder:text-slate-400"
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Name reveal toggle */}
        <div className="flex items-center gap-2.5">
          {namesRevealed && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Names visible — audit logged
            </span>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="show-names"
              checked={namesRevealed}
              onCheckedChange={handleNamesToggle}
              disabled={namesLoading}
              aria-label="Show applicant names"
            />
            <Label
              htmlFor="show-names"
              className="cursor-pointer text-sm text-slate-600 whitespace-nowrap"
            >
              Show names
            </Label>
          </div>
        </div>
      </div>

      {/* Bulk-action toolbar — ADMIN only, shown when ≥1 row is selected */}
      {bulkEnabled && selectedIds.length > 0 && (
        <BulkToolbar
          selectedIds={selectedIds}
          assessors={assessors}
          onClear={handleClearSelection}
          onActionComplete={handleBulkComplete}
          onFeedback={setBulkFeedback}
        />
      )}

      {/* Bulk-action result — lives in the parent so a success message survives
          the toolbar unmounting after the selection is cleared. */}
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
        <div className="min-w-[640px] md:min-w-0 rounded-lg border border-neutral-200 bg-white overflow-hidden">
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
                <TableCell
                  colSpan={columns.length}
                  className="py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium text-slate-500">
                      No applications match the current filters
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
                  onClick={() =>
                    router.push(`/applications/${row.original.id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
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
        Showing {table.getRowModel().rows.length} of {applications.length}{" "}
        application{applications.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
