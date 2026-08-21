"use client";

/**
 * Epic 14 C5 (CG-20, US-C6) — PART 2 - HOUSEHOLD INCOME as ONE Excel-style
 * table: workbook rows verbatim (status blocks in the left column), Parent 1
 * and Parent 2 as two value columns, ending in the auto household total. No
 * commentary copy — the row labels ARE the instructions, per Charlotte.
 *
 * Presentation only (D14-4): each cell writes the per-earner
 * `AssessorIncomeRecord` through `setEarnerField` (block-presence semantics
 * preserved); the totals come from the untouched engine.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AssessorIncomeRecord } from "@/types/assessment-v2";
import {
  INCOME_TABLE_ROWS,
  getEarnerField,
  setEarnerField,
  type IncomeTableRow,
} from "@/lib/assessment/v2/income-table";
import { calculateEarnerIncome } from "@/lib/assessment/v2/income";
import { CurrencyInput } from "@/components/admin/earner-form-v2";

interface IncomeTableV2Props {
  parent1: AssessorIncomeRecord;
  parent2: AssessorIncomeRecord;
  twoEarner: boolean;
  /** Epic 13 C2 — the signed manual adjustment; shown as its own line so the
   * closing AUTO row equals the engine's C40 exactly. */
  manualAdjustment?: number;
  readOnly?: boolean;
  onChangeParent1: (next: AssessorIncomeRecord) => void;
  onChangeParent2: (next: AssessorIncomeRecord) => void;
  /** Fired after a cell commits (blur) — schedules the autosave. */
  onCellBlur?: () => void;
}

function money(v: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(v);
}

export function IncomeTableV2({
  parent1,
  parent2,
  twoEarner,
  manualAdjustment = 0,
  readOnly = false,
  onChangeParent1,
  onChangeParent2,
  onCellBlur,
}: IncomeTableV2Props) {
  const parents: {
    key: "p1" | "p2";
    heading: string;
    record: AssessorIncomeRecord;
    onChange: (next: AssessorIncomeRecord) => void;
    enabled: boolean;
  }[] = [
    { key: "p1", heading: "Parent 1", record: parent1, onChange: onChangeParent1, enabled: true },
    { key: "p2", heading: "Parent 2", record: parent2, onChange: onChangeParent2, enabled: twoEarner },
  ];

  const renderCell = (row: IncomeTableRow, parent: (typeof parents)[number]) => {
    const disabled = readOnly || !parent.enabled;
    if (row.kind === "zero") {
      return <span className="block text-right font-mono text-xs text-slate-400">0</span>;
    }
    if (row.kind === "la8") {
      return <span className="block text-right font-mono text-xs text-slate-300">—</span>;
    }
    const id = `income-${parent.key}-${row.blockKey}-${row.fieldKey}`;
    const value = getEarnerField(parent.record, row.blockKey!, row.fieldKey!);
    const cell = (
      <CurrencyInput
        id={id}
        value={value}
        disabled={disabled}
        ariaLabel={`${row.label} — ${parent.heading}`}
        onChange={(v) =>
          parent.onChange(setEarnerField(parent.record, row.blockKey!, row.fieldKey!, v))
        }
        onBlur={onCellBlur}
      />
    );
    if (row.kind === "inputWithDivisor") {
      const divisor = getEarnerField(parent.record, row.blockKey!, row.divisorFieldKey!);
      return (
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">{cell}</div>
          <span className="text-xs text-slate-400" aria-hidden="true">
            /
          </span>
          <Input
            id={`${id}-divisor`}
            type="number"
            min={1}
            value={divisor > 0 ? divisor : ""}
            placeholder="1"
            disabled={disabled}
            aria-label={`${row.label} — ${parent.heading} — number of kids divisor`}
            onChange={(e) =>
              parent.onChange(
                setEarnerField(
                  parent.record,
                  row.blockKey!,
                  row.divisorFieldKey!,
                  Math.max(0, Number(e.target.value) || 0)
                )
              )
            }
            onBlur={onCellBlur}
            className="w-16 text-right font-mono"
          />
        </div>
      );
    }
    return cell;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="w-[220px] px-3 py-2">Status</th>
            <th className="px-3 py-2">Income line</th>
            {parents.map((p) => (
              <th key={p.key} className="w-[190px] px-3 py-2 text-right">
                {p.heading}
                {p.key === "p2" && !p.enabled && (
                  <span className="ml-1 font-normal normal-case text-slate-400">(off)</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {INCOME_TABLE_ROWS.map((row, i) => (
            <tr
              key={`${row.label}-${i}`}
              className={cn(
                "border-b border-slate-100 last:border-b-0",
                row.statusBlock && "border-t border-slate-200"
              )}
            >
              <td className="px-3 py-1.5 align-top text-[11px] font-semibold uppercase leading-tight text-slate-500">
                {row.statusBlock ?? ""}
              </td>
              <td className="px-3 py-1.5 align-top">
                <span className="text-xs font-medium text-slate-700">{row.label}</span>
                {row.note && (
                  <span className="mt-0.5 block text-[11px] leading-tight text-amber-700">
                    {row.note}
                  </span>
                )}
              </td>
              {parents.map((p) => (
                <td key={p.key} className="px-3 py-1.5 align-top">
                  {renderCell(row, p)}
                </td>
              ))}
            </tr>
          ))}

          {/* Per-earner computed income + the workbook's closing AUTO row. */}
          <tr className="border-t-2 border-primary-200 bg-primary-50/60">
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-800">
              Earner total
            </td>
            {parents.map((p) => (
              <td key={p.key} className="px-3 py-2 text-right font-mono text-sm font-semibold text-primary-900">
                {p.enabled ? money(calculateEarnerIncome(p.record)) : "—"}
              </td>
            ))}
          </tr>
          {manualAdjustment !== 0 && (
            <tr className="bg-amber-50/70">
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                Manual income adjustment
              </td>
              <td
                className="px-3 py-2 text-right font-mono text-sm font-semibold text-amber-900"
                colSpan={2}
              >
                {manualAdjustment > 0 ? "+" : ""}
                {money(manualAdjustment)}
              </td>
            </tr>
          )}
          <tr className="bg-primary-900 text-white">
            <td className="px-3 py-2.5" />
            <td className="px-3 py-2.5 text-xs font-bold uppercase tracking-wide">
              HOUSEHOLD&apos;S OVERALL NET INCOME
            </td>
            <td
              className="px-3 py-2.5 text-right font-mono text-sm font-bold"
              colSpan={2}
            >
              {money(
                Math.max(
                  0,
                  calculateEarnerIncome(parent1) +
                    (twoEarner ? calculateEarnerIncome(parent2) : 0) +
                    manualAdjustment
                )
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
