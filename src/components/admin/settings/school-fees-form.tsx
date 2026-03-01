"use client";

/**
 * Inline edit form for a single SchoolFees row.
 */

import * as React from "react";
import { useTransition } from "react";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { upsertSchoolFeesAction } from "@/app/(admin)/settings/actions";
import type { SchoolFeesRow } from "@/lib/db/queries/reference-tables";
import type { School } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

const SCHOOL_LABELS: Record<School, string> = {
  TRINITY: "Trinity School",
  WHITGIFT: "Whitgift School",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface SchoolFeesRowProps {
  fees: SchoolFeesRow;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SchoolFeesRow({ fees }: SchoolFeesRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [annualFees, setAnnualFees] = React.useState(fees.annualFees.toFixed(2));

  function handleCancel() {
    setAnnualFees(fees.annualFees.toFixed(2));
    setError(null);
    setEditing(false);
  }

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("school", fees.school);
    fd.set("annualFees", annualFees);

    startTransition(async () => {
      const result = await upsertSchoolFeesAction(fd);
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  const schoolLabel = SCHOOL_LABELS[fees.school] ?? fees.school;
  const effectiveYear = fees.effectiveFrom.getFullYear?.() ?? new Date(fees.effectiveFrom).getFullYear();

  if (!editing) {
    return (
      <TableRow>
        <TableCell className="font-medium text-slate-700">{schoolLabel}</TableCell>
        <TableCell className="tabular-nums">{formatGBP(fees.annualFees)}</TableCell>
        <TableCell className="text-sm text-slate-500">
          From {effectiveYear}
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="h-7 gap-1 text-xs"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-amber-50/40">
      <TableCell className="font-medium text-slate-700">{schoolLabel}</TableCell>
      <TableCell>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            £
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={annualFees}
            onChange={(e) => setAnnualFees(e.target.value)}
            className="h-8 pl-6 text-sm w-32"
            aria-label="Annual fees"
          />
        </div>
      </TableCell>
      <TableCell className="text-sm text-slate-500">
        New version from today
      </TableCell>
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
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
