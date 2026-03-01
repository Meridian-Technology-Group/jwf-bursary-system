"use client";

/**
 * Edit form for the CouncilTaxDefault.
 */

import * as React from "react";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCouncilTaxAction } from "@/app/(admin)/settings/actions";
import type { CouncilTaxDefaultRow } from "@/lib/db/queries/reference-tables";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CouncilTaxFormProps {
  current: CouncilTaxDefaultRow | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CouncilTaxForm({ current }: CouncilTaxFormProps) {
  const [amount, setAmount] = React.useState(
    current ? current.amount.toFixed(2) : ""
  );
  const [description, setDescription] = React.useState(
    current?.description ?? "Band D Croydon"
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("description", description);

    startTransition(async () => {
      const result = await updateCouncilTaxAction(fd);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="max-w-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="councilTaxAmount" className="text-sm font-medium">
          Annual Amount (£)
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            £
          </span>
          <Input
            id="councilTaxAmount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setSaved(false);
            }}
            className="pl-7"
            placeholder="2480.00"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="councilTaxDescription" className="text-sm font-medium">
          Description
        </Label>
        <Input
          id="councilTaxDescription"
          type="text"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
          placeholder="Band D Croydon"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="bg-primary-800 hover:bg-primary-700 gap-2"
        >
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          Save Council Tax Rate
        </Button>
        {saved && (
          <p className="text-sm text-emerald-600 font-medium" role="status">
            Saved successfully
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {current && (
        <p className="text-xs text-slate-400">
          Current value: £{current.amount.toFixed(2)} ({current.description}),
          effective from{" "}
          {new Date(current.effectiveFrom).toLocaleDateString("en-GB")}
        </p>
      )}
    </div>
  );
}
