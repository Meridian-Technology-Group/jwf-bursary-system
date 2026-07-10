"use client";

/**
 * Interactive close-reason management table (item 4.3, Story 4.3).
 * Supports inline editing, adding new reasons, the purge-on-close toggle,
 * and deprecation — modelled on reason-code-table.tsx.
 */

import * as React from "react";
import { useTransition } from "react";
import { Plus, Pencil, X, Check, Loader2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { upsertCloseReasonAction } from "@/app/(admin)/settings/actions";
import type { CloseReasonRow } from "@/lib/db/queries/reference-tables";

// The destructive-styled switch used for the purge-on-close toggle. Checked
// (purge) renders red, not the default primary colour, because this is the
// one setting on this page that causes permanent data loss on future closes.
const PURGE_SWITCH_CLASS =
  "data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-input";

const PURGE_HELPER_TEXT =
  "Closing with this reason permanently removes the applicant's personal data and documents";

// ─── Inline edit row ──────────────────────────────────────────────────────────

interface EditableRowProps {
  row: CloseReasonRow;
}

function EditableRow({ row }: EditableRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [label, setLabel] = React.useState(row.label);
  const [purgeOnClose, setPurgeOnClose] = React.useState(row.purgeOnClose);
  const [sortOrder, setSortOrder] = React.useState(String(row.sortOrder));

  function handleCancel() {
    setLabel(row.label);
    setPurgeOnClose(row.purgeOnClose);
    setSortOrder(String(row.sortOrder));
    setError(null);
    setEditing(false);
  }

  function save(overrides?: { purgeOnClose?: boolean }) {
    setError(null);
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("label", label);
    fd.set("purgeOnClose", String(overrides?.purgeOnClose ?? purgeOnClose));
    fd.set("isDeprecated", String(row.isDeprecated));
    fd.set("sortOrder", sortOrder);

    startTransition(async () => {
      const result = await upsertCloseReasonAction(fd);
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleTogglePurgeOnClose(checked: boolean) {
    setPurgeOnClose(checked);
    save({ purgeOnClose: checked });
  }

  function handleToggleDeprecated() {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("label", row.label);
    fd.set("purgeOnClose", String(row.purgeOnClose));
    fd.set("isDeprecated", String(!row.isDeprecated));
    fd.set("sortOrder", String(row.sortOrder));

    startTransition(async () => {
      const result = await upsertCloseReasonAction(fd);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  if (!editing) {
    return (
      <TableRow className={row.isDeprecated ? "opacity-60" : undefined}>
        <TableCell className="text-sm text-slate-700 max-w-xs">{row.label}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Switch
              checked={row.purgeOnClose}
              onCheckedChange={handleTogglePurgeOnClose}
              disabled={isPending || row.isDeprecated}
              className={PURGE_SWITCH_CLASS}
              aria-label="Purge on close"
            />
            {row.purgeOnClose && (
              <Badge className="bg-red-100 text-red-800 text-xs hover:bg-red-100">
                Purges data
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {row.isDeprecated ? (
            <Badge variant="secondary" className="text-xs">
              Deprecated
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-800 text-xs hover:bg-emerald-100">
              Active
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="h-7 gap-1 text-xs"
              disabled={isPending}
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleDeprecated}
              disabled={isPending}
              className="h-7 text-xs text-slate-500 hover:text-slate-700"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : row.isDeprecated ? (
                "Restore"
              ) : (
                "Deprecate"
              )}
            </Button>
          </div>
          {error && (
            <p className="mt-0.5 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-amber-50/40">
      <TableCell>
        <Input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 text-sm"
          aria-label="Label"
        />
        <Input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="mt-1 h-7 text-xs w-20"
          aria-label="Sort order"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={purgeOnClose}
            onCheckedChange={setPurgeOnClose}
            disabled={isPending}
            className={PURGE_SWITCH_CLASS}
            aria-label="Purge on close"
          />
        </div>
      </TableCell>
      <TableCell />
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => save()}
            disabled={isPending}
            className="h-7 gap-1 text-xs bg-primary-800 hover:bg-primary-700"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3 w-3" aria-hidden="true" />
            )}
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
            className="h-7 gap-1 text-xs"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Cancel
          </Button>
        </div>
        {error && (
          <p className="mt-0.5 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Add new row ──────────────────────────────────────────────────────────────

function AddCloseReasonRow({
  nextSortOrder,
  onDone,
}: {
  nextSortOrder: number;
  onDone: () => void;
}) {
  const [label, setLabel] = React.useState("");
  const [purgeOnClose, setPurgeOnClose] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState(String(nextSortOrder));
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("label", label);
    fd.set("purgeOnClose", String(purgeOnClose));
    fd.set("isDeprecated", "false");
    fd.set("sortOrder", sortOrder || String(nextSortOrder));

    startTransition(async () => {
      const result = await upsertCloseReasonAction(fd);
      if (result.success) {
        onDone();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <TableRow className="bg-blue-50/40">
      <TableCell>
        <Input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 text-sm"
          placeholder="Reason for closing"
          aria-label="Label"
        />
        <Input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="mt-1 h-7 text-xs w-20"
          placeholder="Auto"
          aria-label="Sort order"
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={purgeOnClose}
          onCheckedChange={setPurgeOnClose}
          disabled={isPending}
          className={PURGE_SWITCH_CLASS}
          aria-label="Purge on close"
        />
      </TableCell>
      <TableCell />
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="h-7 gap-1 text-xs bg-primary-800 hover:bg-primary-700"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3 w-3" aria-hidden="true" />
            )}
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDone}
            disabled={isPending}
            className="h-7 gap-1 text-xs"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Cancel
          </Button>
        </div>
        {error && (
          <p className="mt-0.5 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

interface CloseReasonTableProps {
  closeReasons: CloseReasonRow[];
}

export function CloseReasonTable({ closeReasons }: CloseReasonTableProps) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [filterActive, setFilterActive] = React.useState<
    "all" | "active" | "deprecated"
  >("all");

  const filtered = closeReasons.filter((cr) => {
    if (filterActive === "active") return !cr.isDeprecated;
    if (filterActive === "deprecated") return cr.isDeprecated;
    return true;
  });

  const nextSortOrder =
    closeReasons.reduce((max, cr) => Math.max(max, cr.sortOrder), 0) + 1;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {(["all", "active", "deprecated"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterActive(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filterActive === f
                  ? "bg-primary-800 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAdd(true)}
          disabled={showAdd}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Close Reason
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs">Label</TableHead>
              <TableHead className="w-64 text-xs">
                <span className="inline-flex items-center gap-1">
                  Purge on Close
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                        aria-label="What does Purge on Close do?"
                      >
                        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {PURGE_HELPER_TEXT}
                    </TooltipContent>
                  </Tooltip>
                </span>
              </TableHead>
              <TableHead className="w-28 text-xs">Status</TableHead>
              <TableHead className="w-36 text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showAdd && (
              <AddCloseReasonRow
                nextSortOrder={nextSortOrder}
                onDone={() => setShowAdd(false)}
              />
            )}
            {filtered.map((cr) => (
              <EditableRow key={cr.id} row={cr} />
            ))}
            {filtered.length === 0 && !showAdd && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-sm text-slate-400"
                >
                  No close reasons match the current filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-slate-400">
        {closeReasons.filter((cr) => !cr.isDeprecated).length} active,{" "}
        {closeReasons.filter((cr) => cr.isDeprecated).length} deprecated
      </p>
      </div>
    </TooltipProvider>
  );
}
