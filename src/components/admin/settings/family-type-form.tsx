"use client";

/**
 * Inline edit form for a single FamilyTypeConfig row.
 * Renders display mode by default; clicking Edit reveals inputs.
 */

import * as React from "react";
import { useTransition } from "react";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { upsertFamilyTypeConfigAction } from "@/app/(admin)/settings/actions";
import type { FamilyTypeConfigRow } from "@/lib/db/queries/reference-tables";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FamilyTypeRowProps {
  config: FamilyTypeConfigRow;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FamilyTypeRow({ config }: FamilyTypeRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [notionalRent, setNotionalRent] = React.useState(
    config.notionalRent.toFixed(2)
  );
  const [utilityCosts, setUtilityCosts] = React.useState(
    config.utilityCosts.toFixed(2)
  );
  const [foodCosts, setFoodCosts] = React.useState(config.foodCosts.toFixed(2));

  function handleCancel() {
    setNotionalRent(config.notionalRent.toFixed(2));
    setUtilityCosts(config.utilityCosts.toFixed(2));
    setFoodCosts(config.foodCosts.toFixed(2));
    setError(null);
    setEditing(false);
  }

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("category", String(config.category));
    fd.set("description", config.description);
    fd.set("notionalRent", notionalRent);
    fd.set("utilityCosts", utilityCosts);
    fd.set("foodCosts", foodCosts);

    startTransition(async () => {
      const result = await upsertFamilyTypeConfigAction(fd);
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (!editing) {
    return (
      <TableRow>
        <TableCell className="font-medium text-slate-700">
          {config.category}. {config.description}
        </TableCell>
        <TableCell className="tabular-nums">{formatGBP(config.notionalRent)}</TableCell>
        <TableCell className="tabular-nums">{formatGBP(config.utilityCosts)}</TableCell>
        <TableCell className="tabular-nums">{formatGBP(config.foodCosts)}</TableCell>
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
      <TableCell className="font-medium text-slate-700">
        {config.category}. {config.description}
      </TableCell>
      <TableCell>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            £
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={notionalRent}
            onChange={(e) => setNotionalRent(e.target.value)}
            className="h-8 pl-6 text-sm w-28"
            aria-label="Notional rent"
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            £
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={utilityCosts}
            onChange={(e) => setUtilityCosts(e.target.value)}
            className="h-8 pl-6 text-sm w-28"
            aria-label="Utility costs"
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            £
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={foodCosts}
            onChange={(e) => setFoodCosts(e.target.value)}
            className="h-8 pl-6 text-sm w-28"
            aria-label="Food costs"
          />
        </div>
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
