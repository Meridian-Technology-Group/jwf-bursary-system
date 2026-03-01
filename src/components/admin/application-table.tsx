"use client";

/**
 * Application queue data table.
 *
 * Client component using @tanstack/react-table for sorting/filtering.
 * Supports per-session name reveal (calls API, writes audit log).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
  MoreHorizontal,
  Eye,
  AlertTriangle,
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

import type { ApplicationListItem } from "@/lib/db/queries/applications";
import type { ApplicationStatus, School } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoundOption = { id: string; academicYear: string; status: string };

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

// ─── Main component ───────────────────────────────────────────────────────────

export function ApplicationTable({
  applications,
  rounds,
}: ApplicationTableProps) {
  const router = useRouter();

  // Filter state
  const [selectedRound, setSelectedRound] = React.useState<string>("all");
  const [selectedSchool, setSelectedSchool] = React.useState<string>("all");
  const [selectedStatuses, setSelectedStatuses] = React.useState<
    ApplicationStatus[]
  >([]);
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

    return base;
  }, [namesRevealed, columnHelper, router]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
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
