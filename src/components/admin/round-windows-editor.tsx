"use client";

/**
 * Epic 14 D1 (CG-01, US-D1) — the "Round scenarios" settings card: the four
 * operating windows (three new-application + rolling re-assessment), each
 * with an admin-editable opening date, submission date and default tax year.
 * Unset cells fall back to the pure resolver's derived defaults (shown as
 * placeholders); RA defaults to the fixed 12 Apr → 22 May window.
 */

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveRoundWindowsAction } from "@/app/(admin)/rounds/actions";
import { toast } from "@/hooks/use-toast";

export interface RoundWindowRowValue {
  scenario: "NA_CURRENT" | "NA_NEXT_WINTER" | "NA_NEXT_SPRING" | "RA";
  /** yyyy-mm-dd or null. */
  opensOn: string | null;
  submitBy: string | null;
  defaultTaxYear: string | null;
}

export interface RoundWindowRowDefaults {
  scenario: RoundWindowRowValue["scenario"];
  label: string;
  opensOn: string;
  submitBy: string;
  defaultTaxYear: string;
}

interface RoundWindowsEditorProps {
  roundId: string;
  initial: RoundWindowRowValue[];
  defaults: RoundWindowRowDefaults[];
  readOnly: boolean;
}

export function RoundWindowsEditor({
  roundId,
  initial,
  defaults,
  readOnly,
}: RoundWindowsEditorProps) {
  const [rows, setRows] = React.useState<RoundWindowRowValue[]>(() =>
    defaults.map(
      (d) =>
        initial.find((w) => w.scenario === d.scenario) ?? {
          scenario: d.scenario,
          opensOn: null,
          submitBy: null,
          defaultTaxYear: null,
        }
    )
  );
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const update = (
    scenario: RoundWindowRowValue["scenario"],
    patch: Partial<RoundWindowRowValue>
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.scenario === scenario ? { ...r, ...patch } : r))
    );
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const result = await saveRoundWindowsAction(
      roundId,
      rows.map((r) => ({
        scenario: r.scenario,
        opensOn: r.opensOn || null,
        submitBy: r.submitBy || null,
        defaultTaxYear: r.defaultTaxYear?.trim() || null,
      }))
    );
    setSaving(false);
    if (result.success) {
      setDirty(false);
      toast({ title: "Round scenarios saved" });
    } else {
      toast({
        variant: "destructive",
        title: "Scenarios not saved",
        description: result.error,
      });
    }
  };

  return (
    <section
      aria-label="Round scenarios"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Round scenarios
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            The four operating windows (CG-01). Empty cells use the derived
            defaults shown as placeholders; edits here win everywhere the
            scenario is consumed.
          </p>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            <Save className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {saving ? "Saving…" : "Save scenarios"}
          </Button>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Scenario</th>
              <th className="w-[170px] px-3 py-2">Opening date</th>
              <th className="w-[170px] px-3 py-2">Submission date</th>
              <th className="w-[140px] px-3 py-2">Default tax year</th>
            </tr>
          </thead>
          <tbody>
            {defaults.map((d) => {
              const row = rows.find((r) => r.scenario === d.scenario)!;
              return (
                <tr key={d.scenario} className="border-b border-slate-50 last:border-b-0">
                  <td className="px-3 py-2 text-xs font-medium text-slate-700">
                    {d.label}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      aria-label={`${d.label} opening date`}
                      value={row.opensOn ?? ""}
                      placeholder={d.opensOn}
                      disabled={readOnly}
                      onChange={(e) =>
                        update(d.scenario, { opensOn: e.target.value || null })
                      }
                      className="text-xs"
                    />
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      default {d.opensOn}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      aria-label={`${d.label} submission date`}
                      value={row.submitBy ?? ""}
                      placeholder={d.submitBy}
                      disabled={readOnly}
                      onChange={(e) =>
                        update(d.scenario, { submitBy: e.target.value || null })
                      }
                      className="text-xs"
                    />
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      default {d.submitBy}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      aria-label={`${d.label} default tax year`}
                      value={row.defaultTaxYear ?? ""}
                      placeholder={d.defaultTaxYear}
                      disabled={readOnly}
                      onChange={(e) =>
                        update(d.scenario, {
                          defaultTaxYear: e.target.value || null,
                        })
                      }
                      className="font-mono text-xs"
                    />
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      default {d.defaultTaxYear}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
