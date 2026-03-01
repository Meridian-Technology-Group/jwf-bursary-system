"use client";

/**
 * Interactive reason code management table.
 * Supports inline editing, adding new codes, and deprecation toggles.
 */

import * as React from "react";
import { useTransition } from "react";
import { Plus, Pencil, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { upsertReasonCodeAction } from "@/app/(admin)/settings/actions";
import type { ReasonCodeRow } from "@/lib/db/queries/reference-tables";

// ─── Category helpers ──────────────────────────────────────────────────────────

function getCategory(code: number): string {
  if (code >= 1 && code <= 9) return "Income";
  if (code >= 10 && code <= 19) return "Property & Assets";
  if (code >= 20 && code <= 29) return "Family Circumstances";
  if (code >= 30 && code <= 39) return "Risk Flags";
  return "Other";
}

// ─── Inline edit row ──────────────────────────────────────────────────────────

interface EditableRowProps {
  row: ReasonCodeRow;
}

function EditableRow({ row }: EditableRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [code, setCode] = React.useState(String(row.code));
  const [label, setLabel] = React.useState(row.label);
  const [sortOrder, setSortOrder] = React.useState(String(row.sortOrder));

  function handleCancel() {
    setCode(String(row.code));
    setLabel(row.label);
    setSortOrder(String(row.sortOrder));
    setError(null);
    setEditing(false);
  }

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("code", code);
    fd.set("label", label);
    fd.set("isDeprecated", String(row.isDeprecated));
    fd.set("sortOrder", sortOrder);

    startTransition(async () => {
      const result = await upsertReasonCodeAction(fd);
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleToggleDeprecated() {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("code", String(row.code));
    fd.set("label", row.label);
    fd.set("isDeprecated", String(!row.isDeprecated));
    fd.set("sortOrder", String(row.sortOrder));

    startTransition(async () => {
      const result = await upsertReasonCodeAction(fd);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  if (!editing) {
    return (
      <TableRow className={row.isDeprecated ? "opacity-60" : undefined}>
        <TableCell className="font-mono text-sm font-semibold text-slate-600">
          {row.code}
        </TableCell>
        <TableCell className="text-sm text-slate-700 max-w-xs">{row.label}</TableCell>
        <TableCell>
          <span className="text-xs text-slate-500">{getCategory(row.code)}</span>
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
          type="number"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-8 text-sm w-20"
          aria-label="Code"
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 text-sm"
          aria-label="Label"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="h-8 text-sm w-20"
          aria-label="Sort order"
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

function AddReasonCodeRow({ onDone }: { onDone: () => void }) {
  const [code, setCode] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("code", code);
    fd.set("label", label);
    fd.set("isDeprecated", "false");
    fd.set("sortOrder", sortOrder || code);

    startTransition(async () => {
      const result = await upsertReasonCodeAction(fd);
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
          type="number"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-8 text-sm w-20"
          placeholder="36"
          aria-label="Code"
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 text-sm"
          placeholder="Description of reason code"
          aria-label="Label"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="h-8 text-sm w-20"
          placeholder="Auto"
          aria-label="Sort order"
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

interface ReasonCodeTableProps {
  reasonCodes: ReasonCodeRow[];
}

export function ReasonCodeTable({ reasonCodes }: ReasonCodeTableProps) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [filterActive, setFilterActive] = React.useState<
    "all" | "active" | "deprecated"
  >("all");

  const filtered = reasonCodes.filter((rc) => {
    if (filterActive === "active") return !rc.isDeprecated;
    if (filterActive === "deprecated") return rc.isDeprecated;
    return true;
  });

  return (
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
          Add Reason Code
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-20 text-xs">Code</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="w-28 text-xs">Status</TableHead>
              <TableHead className="w-36 text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showAdd && (
              <AddReasonCodeRow onDone={() => setShowAdd(false)} />
            )}
            {filtered.map((rc) => (
              <EditableRow key={rc.id} row={rc} />
            ))}
            {filtered.length === 0 && !showAdd && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-slate-400"
                >
                  No reason codes match the current filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-slate-400">
        {reasonCodes.filter((rc) => !rc.isDeprecated).length} active,{" "}
        {reasonCodes.filter((rc) => rc.isDeprecated).length} deprecated
      </p>
    </div>
  );
}
