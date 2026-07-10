"use client";

/**
 * CALC-11 — Generic "read-heavy table + duplicate-and-edit new-version
 * dialog" section, reused by all six Appendix B/C benchmark-band tables
 * (Affordability, Income Category, Property Equity, Financial Equity, Debt
 * Ratio, Lifestyle Squeeze). The six tables all share the same shape — a
 * floor/ceiling pair plus 1-2 extra fields — so one configurable component
 * replaces what would otherwise be six near-identical files.
 *
 * `floorKey`/`ceilingKey` are the REAL Prisma field names (`bandFloor` /
 * `bandCeiling` or `ratioFloor` / `ratioCeiling`) so the row objects built
 * here can be JSON-stringified straight into the `rows` FormData field each
 * `create*BandVersionAction` expects — no renaming step needed.
 *
 * "Blank" floor/ceiling inputs mean an open-ended band (`null`) — the same
 * convention the six Prisma models and `reference-bands.ts` use.
 */

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SettingsActionResult } from "@/app/(admin)/settings/actions";

// ─── Config types ──────────────────────────────────────────────────────────

export interface BandExtraFieldConfig {
  key: string;
  label: string;
  type: "number" | "text" | "nullableNumber";
  width?: string;
}

export interface BandVersionSectionProps {
  title: string;
  description: string;
  floorKey: string;
  ceilingKey: string;
  floorLabel: string;
  ceilingLabel: string;
  extraFields: BandExtraFieldConfig[];
  /**
   * Current generation rows, keyed by `floorKey`/`ceilingKey`/extra field
   * keys. Typed loosely (`unknown` values) so the fetched `*Row` types
   * (which also carry `id`/`effectiveFrom`/etc.) can be passed straight
   * through without a mapping step at each call site.
   */
  rows: ReadonlyArray<object>;
  createVersionAction: (formData: FormData) => Promise<SettingsActionResult>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function displayValue(value: unknown, openLabel = "open-ended"): string {
  if (value === null || value === undefined) return openLabel;
  return String(value);
}

type EditableRow = Record<string, string>;

function toEditableRows(rows: ReadonlyArray<object>): EditableRow[] {
  return rows.map((row) => {
    const editable: EditableRow = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      editable[key] = toInputValue(value);
    }
    return editable;
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BandVersionSection({
  title,
  description,
  floorKey,
  ceilingKey,
  floorLabel,
  ceilingLabel,
  extraFields,
  rows,
  createVersionAction,
}: BandVersionSectionProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <BandVersionDialog
          title={title}
          floorKey={floorKey}
          ceilingKey={ceilingKey}
          floorLabel={floorLabel}
          ceilingLabel={ceilingLabel}
          extraFields={extraFields}
          rows={rows}
          createVersionAction={createVersionAction}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs">{floorLabel}</TableHead>
              <TableHead className="text-xs">{ceilingLabel}</TableHead>
              {extraFields.map((f) => (
                <TableHead key={f.key} className="text-xs">
                  {f.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((rawRow, index) => {
              const row = rawRow as Record<string, unknown>;
              return (
                // eslint-disable-next-line react/no-array-index-key -- rows have no stable id in this read-only projection
                <TableRow key={index}>
                  <TableCell className="text-sm tabular-nums">
                    {displayValue(row[floorKey])}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {displayValue(row[ceilingKey])}
                  </TableCell>
                  {extraFields.map((f) => (
                    <TableCell key={f.key} className="text-sm">
                      {displayValue(row[f.key])}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={extraFields.length + 2}
                  className="py-6 text-center text-sm text-slate-400"
                >
                  No bands found. Run the seed script to populate.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── New-version dialog ─────────────────────────────────────────────────────

interface BandVersionDialogProps {
  title: string;
  floorKey: string;
  ceilingKey: string;
  floorLabel: string;
  ceilingLabel: string;
  extraFields: BandExtraFieldConfig[];
  rows: ReadonlyArray<object>;
  createVersionAction: (formData: FormData) => Promise<SettingsActionResult>;
}

function BandVersionDialog({
  title,
  floorKey,
  ceilingKey,
  floorLabel,
  ceilingLabel,
  extraFields,
  rows,
  createVersionAction,
}: BandVersionDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [editRows, setEditRows] = React.useState<EditableRow[]>(() => toEditableRows(rows));
  const [effectiveFrom, setEffectiveFrom] = React.useState(todayIso());
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setEditRows(toEditableRows(rows));
      setEffectiveFrom(todayIso());
      setError(null);
    }
  }

  function updateCell(index: number, key: string, value: string) {
    setEditRows((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function handleSave() {
    setError(null);

    const payload: Array<Record<string, number | string | null>> = [];
    for (const row of editRows) {
      const floorRaw = row[floorKey] ?? "";
      const ceilingRaw = row[ceilingKey] ?? "";
      const floor = floorRaw.trim() === "" ? null : parseFloat(floorRaw);
      const ceiling = ceilingRaw.trim() === "" ? null : parseFloat(ceilingRaw);

      if (floor !== null && isNaN(floor)) {
        setError(`Invalid ${floorLabel.toLowerCase()} value.`);
        return;
      }
      if (ceiling !== null && isNaN(ceiling)) {
        setError(`Invalid ${ceilingLabel.toLowerCase()} value.`);
        return;
      }

      const parsedRow: Record<string, number | string | null> = {
        [floorKey]: floor,
        [ceilingKey]: ceiling,
      };

      for (const field of extraFields) {
        const raw = row[field.key] ?? "";
        if (field.type === "text") {
          const trimmed = raw.trim();
          if (!trimmed) {
            setError(`${field.label} is required on every row.`);
            return;
          }
          parsedRow[field.key] = trimmed;
        } else if (field.type === "nullableNumber") {
          if (raw.trim() === "") {
            parsedRow[field.key] = null;
          } else {
            const num = parseFloat(raw);
            if (isNaN(num)) {
              setError(`Invalid ${field.label.toLowerCase()} value.`);
              return;
            }
            parsedRow[field.key] = num;
          }
        } else {
          const num = parseFloat(raw);
          if (isNaN(num)) {
            setError(`Invalid ${field.label.toLowerCase()} value.`);
            return;
          }
          parsedRow[field.key] = num;
        }
      }

      payload.push(parsedRow);
    }

    const fd = new FormData();
    fd.set("rows", JSON.stringify(payload));
    fd.set("effectiveFrom", effectiveFrom);

    startTransition(async () => {
      const result = await createVersionAction(fd);
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Create New Version
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New {title} Version</DialogTitle>
          <DialogDescription>
            Prefilled from the current version. Leave a floor/ceiling blank for an
            open-ended band. Saving inserts a whole new set of rows effective from the
            date below — the existing version is kept, never mutated.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">{floorLabel}</TableHead>
                <TableHead className="text-xs">{ceilingLabel}</TableHead>
                {extraFields.map((f) => (
                  <TableHead key={f.key} className="text-xs">
                    {f.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {editRows.map((row, index) => (
                // eslint-disable-next-line react/no-array-index-key -- row order is stable within one edit session
                <TableRow key={index}>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      step="any"
                      value={row[floorKey] ?? ""}
                      onChange={(e) => updateCell(index, floorKey, e.target.value)}
                      placeholder="open"
                      className="h-8 text-xs w-24"
                      aria-label={`${floorLabel} row ${index + 1}`}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      step="any"
                      value={row[ceilingKey] ?? ""}
                      onChange={(e) => updateCell(index, ceilingKey, e.target.value)}
                      placeholder="open"
                      className="h-8 text-xs w-24"
                      aria-label={`${ceilingLabel} row ${index + 1}`}
                    />
                  </TableCell>
                  {extraFields.map((f) => (
                    <TableCell key={f.key} className="p-1">
                      <Input
                        type={f.type === "text" ? "text" : "number"}
                        step={f.type === "text" ? undefined : "any"}
                        value={row[f.key] ?? ""}
                        onChange={(e) => updateCell(index, f.key, e.target.value)}
                        className={`h-8 text-xs ${f.width ?? "w-28"}`}
                        aria-label={`${f.label} row ${index + 1}`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor={`${title}-effective-from`} className="text-xs whitespace-nowrap">
            Effective from
          </Label>
          <Input
            id={`${title}-effective-from`}
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="h-8 w-40 text-xs"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="gap-1.5 bg-primary-800 hover:bg-primary-700"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Save New Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
