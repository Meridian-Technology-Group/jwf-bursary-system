"use client";

/**
 * CALC-11 — "Notional Costs" settings tab.
 *
 * Two read-heavy tables (NotionalCostConfig matrix + FamilyCategoryMeta),
 * each with a "Create New Version" dialog that duplicates the CURRENT
 * generation into editable inputs (never mutates existing rows — the same
 * versioned-row convention as every other settings tab). Saving inserts a
 * whole new generation dated by the chosen effective-from date.
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
import {
  createNotionalCostConfigVersionAction,
  createFamilyCategoryMetaVersionAction,
} from "@/app/(admin)/settings/actions";
import type {
  NotionalCostConfigRow,
  FamilyCategoryMetaRow,
} from "@/lib/db/queries/reference-tables";
import type { NotionalCostType } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const COST_TYPES: NotionalCostType[] = [
  "RENT",
  "COUNCIL_TAX",
  "ESSENTIALS",
  "CAR",
  "PUBLIC_TRANSPORT",
  "JWF_ALLOWANCE",
  "NOTIONAL_SAVINGS",
  "SAVINGS_CUSHION",
];

const COST_TYPE_LABELS: Record<NotionalCostType, string> = {
  RENT: "Rent",
  COUNCIL_TAX: "Council Tax",
  ESSENTIALS: "Essentials (composite)",
  CAR: "Car",
  PUBLIC_TRANSPORT: "Public Transport",
  JWF_ALLOWANCE: "JWF Allowance",
  NOTIONAL_SAVINGS: "Notional Savings Benchmark",
  SAVINGS_CUSHION: "Savings Cushion",
};

const CATEGORIES = [1, 2, 3, 4, 5, 6];

// ─── Notional cost matrix ───────────────────────────────────────────────────

type MatrixCell = { category: number; costType: NotionalCostType; amount: string };

function buildMatrix(rows: NotionalCostConfigRow[]): MatrixCell[][] {
  return COST_TYPES.map((costType) =>
    CATEGORIES.map((category) => {
      const found = rows.find((r) => r.category === category && r.costType === costType);
      return { category, costType, amount: (found?.amount ?? 0).toFixed(2) };
    })
  );
}

function NotionalCostVersionDialog({ current }: { current: NotionalCostConfigRow[] }) {
  const [open, setOpen] = React.useState(false);
  const [matrix, setMatrix] = React.useState<MatrixCell[][]>(() => buildMatrix(current));
  const [effectiveFrom, setEffectiveFrom] = React.useState(todayIso());
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setMatrix(buildMatrix(current));
      setEffectiveFrom(todayIso());
      setError(null);
    }
  }

  function setCell(rowIndex: number, colIndex: number, value: string) {
    setMatrix((prev) => {
      const next = prev.map((row) => row.slice());
      next[rowIndex][colIndex] = { ...next[rowIndex][colIndex], amount: value };
      return next;
    });
  }

  function handleSave() {
    setError(null);
    const rows = matrix.flat().map((cell) => ({
      category: cell.category,
      costType: cell.costType,
      amount: parseFloat(cell.amount),
    }));
    if (rows.some((r) => isNaN(r.amount))) {
      setError("Every cell needs a valid amount.");
      return;
    }

    const fd = new FormData();
    fd.set("rows", JSON.stringify(rows));
    fd.set("effectiveFrom", effectiveFrom);

    startTransition(async () => {
      const result = await createNotionalCostConfigVersionAction(fd);
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New Notional Cost Config Version</DialogTitle>
          <DialogDescription>
            Prefilled from the current version. Saving inserts a whole new set of rows
            effective from the date below — the existing version is kept, never mutated.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Cost Type</TableHead>
                {CATEGORIES.map((c) => (
                  <TableHead key={c} className="text-xs text-center">
                    Cat {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((row, rowIndex) => (
                <TableRow key={row[0].costType}>
                  <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">
                    {COST_TYPE_LABELS[row[0].costType]}
                  </TableCell>
                  {row.map((cell, colIndex) => (
                    <TableCell key={cell.category} className="p-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cell.amount}
                        onChange={(e) => setCell(rowIndex, colIndex, e.target.value)}
                        className="h-8 text-xs w-24"
                        aria-label={`${COST_TYPE_LABELS[cell.costType]} category ${cell.category}`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="notional-effective-from" className="text-xs whitespace-nowrap">
            Effective from
          </Label>
          <Input
            id="notional-effective-from"
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

// ─── Family category meta ──────────────────────────────────────────────────

type MetaRowInput = {
  category: number;
  familyMembers: string;
  schoolAgeChildren: string;
  description: string;
};

function FamilyCategoryMetaVersionDialog({ current }: { current: FamilyCategoryMetaRow[] }) {
  const [open, setOpen] = React.useState(false);
  const buildRows = React.useCallback(
    (): MetaRowInput[] =>
      CATEGORIES.map((category) => {
        const found = current.find((r) => r.category === category);
        return {
          category,
          familyMembers: String(found?.familyMembers ?? ""),
          schoolAgeChildren: String(found?.schoolAgeChildren ?? ""),
          description: found?.description ?? "",
        };
      }),
    [current]
  );
  const [rows, setRows] = React.useState<MetaRowInput[]>(() => buildRows());
  const [effectiveFrom, setEffectiveFrom] = React.useState(todayIso());
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setRows(buildRows());
      setEffectiveFrom(todayIso());
      setError(null);
    }
  }

  function updateRow(index: number, field: keyof MetaRowInput, value: string) {
    setRows((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleSave() {
    setError(null);
    const payload = rows.map((r) => ({
      category: r.category,
      familyMembers: parseInt(r.familyMembers, 10),
      schoolAgeChildren: parseInt(r.schoolAgeChildren, 10),
      description: r.description.trim(),
    }));
    if (payload.some((r) => isNaN(r.familyMembers) || isNaN(r.schoolAgeChildren) || !r.description)) {
      setError("Every row needs family members, school-age children, and a description.");
      return;
    }

    const fd = new FormData();
    fd.set("rows", JSON.stringify(payload));
    fd.set("effectiveFrom", effectiveFrom);

    startTransition(async () => {
      const result = await createFamilyCategoryMetaVersionAction(fd);
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
          <DialogTitle>New Family Category Meta Version</DialogTitle>
          <DialogDescription>
            Prefilled from the current version. Saving inserts a new set of 6 rows effective
            from the date below.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-16 text-xs">Cat</TableHead>
                <TableHead className="text-xs">Family Members</TableHead>
                <TableHead className="text-xs">School-Age Children</TableHead>
                <TableHead className="text-xs">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.category}>
                  <TableCell className="text-xs font-medium">{row.category}</TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min="1"
                      value={row.familyMembers}
                      onChange={(e) => updateRow(index, "familyMembers", e.target.value)}
                      className="h-8 text-xs w-20"
                      aria-label={`Family members for category ${row.category}`}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min="0"
                      value={row.schoolAgeChildren}
                      onChange={(e) => updateRow(index, "schoolAgeChildren", e.target.value)}
                      className="h-8 text-xs w-20"
                      aria-label={`School-age children for category ${row.category}`}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateRow(index, "description", e.target.value)}
                      className="h-8 text-xs"
                      aria-label={`Description for category ${row.category}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="meta-effective-from" className="text-xs whitespace-nowrap">
            Effective from
          </Label>
          <Input
            id="meta-effective-from"
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

// ─── Tab ──────────────────────────────────────────────────────────────────

interface NotionalCostTabProps {
  notionalCosts: NotionalCostConfigRow[];
  familyCategoryMetas: FamilyCategoryMetaRow[];
}

export function NotionalCostTab({ notionalCosts, familyCategoryMetas }: NotionalCostTabProps) {
  const matrix = React.useMemo(() => buildMatrix(notionalCosts), [notionalCosts]);

  return (
    <div className="space-y-6">
      {/* Family category meta */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-primary-900">Family Category Meta</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              The household shape each of the 6 notional-cost categories represents (Appendix A).
            </p>
          </div>
          <FamilyCategoryMetaVersionDialog current={familyCategoryMetas} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-16 text-xs">Cat</TableHead>
                <TableHead className="text-xs">Family Members</TableHead>
                <TableHead className="text-xs">School-Age Children</TableHead>
                <TableHead className="text-xs">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CATEGORIES.map((category) => {
                const meta = familyCategoryMetas.find((m) => m.category === category);
                return (
                  <TableRow key={category}>
                    <TableCell className="text-sm font-medium">{category}</TableCell>
                    <TableCell className="text-sm">{meta?.familyMembers ?? "—"}</TableCell>
                    <TableCell className="text-sm">{meta?.schoolAgeChildren ?? "—"}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {meta?.description ?? "Not seeded"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Notional cost matrix */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-primary-900">
              Notional Cost Config (Appendix A)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Annual notional cost-of-living figures per family category. Feeds the v2
              notional-spend engine.
            </p>
          </div>
          <NotionalCostVersionDialog current={notionalCosts} />
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Cost Type</TableHead>
                {CATEGORIES.map((c) => (
                  <TableHead key={c} className="text-xs text-center">
                    Cat {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((row) => (
                <TableRow key={row[0].costType}>
                  <TableCell className="text-sm font-medium text-slate-700 whitespace-nowrap">
                    {COST_TYPE_LABELS[row[0].costType]}
                  </TableCell>
                  {row.map((cell) => (
                    <TableCell key={cell.category} className="text-sm text-center tabular-nums">
                      {formatGBP(parseFloat(cell.amount))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {notionalCosts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={CATEGORIES.length + 1}
                    className="py-8 text-center text-sm text-slate-400"
                  >
                    No notional cost configs found. Run the seed script to populate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
