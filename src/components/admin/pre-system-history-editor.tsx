"use client";

/**
 * Epic 14 C8 (CG-24, LA-7) — editor for the MANUAL pre-system YoY history
 * rows. Families that predate the system have no assessment snapshots for
 * their early years; these cells let the office record them so the history
 * table reads continuously. Display data only — never a calculation input.
 */

import * as React from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PreSystemHistoryRow } from "@/lib/assessments/admin-tab";
import { CurrencyInput } from "@/components/admin/earner-form-v2";
import { savePreSystemHistoryAction } from "@/app/(admin)/applications/[id]/assessment/admin/actions";
import { toast } from "@/hooks/use-toast";

interface PreSystemHistoryEditorProps {
  bursaryAccountId: string;
  applicationId: string;
  initial: PreSystemHistoryRow[];
  readOnly: boolean;
}

export function PreSystemHistoryEditor({
  bursaryAccountId,
  applicationId,
  initial,
  readOnly,
}: PreSystemHistoryEditorProps) {
  const [rows, setRows] = React.useState<PreSystemHistoryRow[]>(initial);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const update = (i: number, patch: Partial<PreSystemHistoryRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [...prev, { academicYear: "" }]);
    setDirty(true);
  };

  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const result = await savePreSystemHistoryAction(
      bursaryAccountId,
      applicationId,
      rows.filter((r) => r.academicYear.trim() !== "")
    );
    setSaving(false);
    if (result.success) {
      setDirty(false);
      toast({ title: "Pre-system history saved" });
    } else {
      toast({
        variant: "destructive",
        title: "History not saved",
        description: result.error,
      });
    }
  };

  if (readOnly && rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pre-system years (manual entry)
        </p>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Add year
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              <Save className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {saving ? "Saving…" : "Save rows"}
            </Button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">
          No pre-system rows. Years assessed in the system appear automatically
          in the table below; add rows here only for earlier, paper-era years.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="w-[110px] px-3 py-2">Year</th>
                <th className="px-3 py-2 text-right">Net income</th>
                <th className="px-3 py-2 text-right">Savings</th>
                <th className="px-3 py-2 text-right">Property equity</th>
                <th className="px-3 py-2 text-right">Debt exposure</th>
                <th className="px-3 py-2">Living</th>
                <th className="px-3 py-2">Lifestyle squeeze</th>
                {!readOnly && <th className="w-10 px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-b-0">
                  <td className="px-3 py-1.5">
                    <Input
                      aria-label={`Pre-system year ${i + 1} academic year`}
                      value={row.academicYear}
                      placeholder="2023/24"
                      disabled={readOnly}
                      onChange={(e) => update(i, { academicYear: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </td>
                  {(
                    [
                      "netIncome",
                      "savings",
                      "propertyEquity",
                      "debtExposure",
                    ] as const
                  ).map((key) => (
                    <td key={key} className="px-3 py-1.5">
                      <CurrencyInput
                        ariaLabel={`Pre-system year ${i + 1} ${key}`}
                        value={row[key] ?? 0}
                        disabled={readOnly}
                        onChange={(v) => update(i, { [key]: v })}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5">
                    <Input
                      aria-label={`Pre-system year ${i + 1} living arrangement`}
                      value={row.livingArrangement ?? ""}
                      placeholder="e.g. rent"
                      disabled={readOnly}
                      onChange={(e) => update(i, { livingArrangement: e.target.value })}
                      className="text-xs"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      aria-label={`Pre-system year ${i + 1} lifestyle squeeze`}
                      value={row.lifestyleSqueeze ?? ""}
                      disabled={readOnly}
                      onChange={(e) => update(i, { lifestyleSqueeze: e.target.value })}
                      className="text-xs"
                    />
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label={`Remove pre-system year ${i + 1}`}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
