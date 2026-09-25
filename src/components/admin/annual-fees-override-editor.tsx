"use client";

/**
 * GT migration PR-C (S9) — the account's own annual fees, on the ASSESSMENT
 * ADMIN tab. The OP partnering school has no fee table and every account's
 * fee differs, so the assessment reads this figure for the account's school.
 * ADMIN edits; everyone else sees the figure.
 */

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAnnualFeesOverrideAction } from "@/app/(admin)/applications/[id]/assessment/admin/actions";
import { toast } from "@/hooks/use-toast";

interface AnnualFeesOverrideEditorProps {
  bursaryAccountId: string;
  applicationId: string;
  initial: number | null;
  readOnly: boolean;
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
});

export function AnnualFeesOverrideEditor({
  bursaryAccountId,
  applicationId,
  initial,
  readOnly,
}: AnnualFeesOverrideEditorProps) {
  const [value, setValue] = React.useState(initial == null ? "" : String(initial));
  const [saving, setSaving] = React.useState(false);
  const saved = initial == null ? "" : String(initial);

  if (readOnly) {
    return (
      <p className="text-sm text-slate-700">
        {initial == null ? "Not set" : gbp.format(initial)}
      </p>
    );
  }

  const save = async () => {
    const trimmed = value.trim();
    const amount = trimmed === "" ? null : Number(trimmed);
    if (amount != null && !Number.isFinite(amount)) {
      toast({ variant: "destructive", title: "Enter a number" });
      return;
    }
    setSaving(true);
    const result = await saveAnnualFeesOverrideAction(bursaryAccountId, applicationId, amount);
    setSaving(false);
    if (result.success) {
      toast({ title: amount == null ? "Annual fees cleared" : "Annual fees saved" });
    } else {
      toast({ variant: "destructive", title: "Annual fees not saved", description: result.error });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="annual-fees-override" className="text-sm text-slate-600">
        Annual fees before VAT (£)
      </label>
      <Input
        id="annual-fees-override"
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 w-40 text-sm"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={save}
        disabled={saving || value.trim() === saved}
        className="h-9"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
