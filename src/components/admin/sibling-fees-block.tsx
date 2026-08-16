"use client";

/**
 * Epic 14 C7 (CG-16, US-C8) — the award sheet's "SILBINGS' FEES ALREADY AT A
 * JWF SCHOOL" block (Charlotte's spelling), three rows of
 * name · school select · NET PAYABLE FEES.
 *
 * Where a sibling holds a JWF bursary account (a sibling link), the picker
 * fills the row from the account (name / school / latest net payable fees);
 * otherwise the cells are manual. Persisted as `Assessment.siblingDetails`
 * (the same store Part 1's name rows write).
 *
 * IMPORTANT (D14-4 / field-map LA-8 №2): these rows are the workbook's RECORD
 * of sibling fees. The engine's sequential-absorption input
 * (`siblingPayableFees`) still comes from the LINKED sibling accounts in
 * priority order, exactly as before — a manually typed fee here does not
 * change the calculation. The inline note says so.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SiblingDetail } from "@/types/assessment-v2";
import { CurrencyInput } from "@/components/admin/earner-form-v2";
import { saveAssessmentAction } from "@/app/(admin)/applications/[id]/assessment/actions";
import { toast } from "@/hooks/use-toast";

export interface SiblingAccountOption {
  bursaryAccountId: string;
  childName: string;
  school: "TRINITY" | "WHITGIFT";
  netPayableFees: number | null;
}

interface SiblingFeesBlockProps {
  assessmentId: string;
  applicationId: string;
  initial: SiblingDetail[] | null;
  options: SiblingAccountOption[];
  readOnly: boolean;
}

const NONE = "__manual__";

export function SiblingFeesBlock({
  assessmentId,
  applicationId,
  initial,
  options,
  readOnly,
}: SiblingFeesBlockProps) {
  const [rows, setRows] = React.useState<SiblingDetail[]>(() =>
    [0, 1, 2].map((i) => (Array.isArray(initial) ? initial[i] : undefined) ?? {})
  );
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = React.useCallback(
    (next: SiblingDetail[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const meaningful = next.some(
          (d) => (d.name ?? "").trim() || d.school || d.netPayableFees != null
        );
        const result = await saveAssessmentAction(assessmentId, applicationId, {
          siblingDetails: meaningful ? next : null,
        });
        if (!result.success) {
          toast({
            variant: "destructive",
            title: "Sibling rows not saved",
            description: result.error,
          });
        }
      }, 500);
    },
    [assessmentId, applicationId]
  );

  const update = (i: number, patch: Partial<SiblingDetail>) => {
    setRows((prev) => {
      const next = prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
      persist(next);
      return next;
    });
  };

  const fillFromAccount = (i: number, accountId: string) => {
    if (accountId === NONE) return;
    const opt = options.find((o) => o.bursaryAccountId === accountId);
    if (!opt) return;
    update(i, {
      name: opt.childName,
      school: opt.school,
      netPayableFees: opt.netPayableFees,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          SILBINGS&apos; FEES ALREADY AT A JWF SCHOOL
        </p>
        <p className="mt-1 text-[11px] leading-tight text-slate-400">
          Record of sibling fees. The calculation&apos;s sibling absorption
          still reads the LINKED sibling bursary accounts in priority order —
          a manually typed fee here does not change the computed legs
          (LA-8, sign-off pending).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2">Child name</th>
              <th className="w-[200px] px-4 py-2">SELECT WHITGIFT OR TRINITY</th>
              <th className="w-[170px] px-4 py-2 text-right">NET PAYABLE FEES</th>
              {options.length > 0 && !readOnly && (
                <th className="w-[210px] px-4 py-2">Fill from bursary account</th>
              )}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i} className="border-b border-slate-50 last:border-b-0">
                <td className="px-4 py-2">
                  <Input
                    aria-label={`ENTER CHILD NAME ${i + 1} - MANUAL`}
                    value={rows[i]?.name ?? ""}
                    placeholder={`ENTER CHILD NAME ${i + 1} - MANUAL`}
                    disabled={readOnly}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="text-sm"
                  />
                </td>
                <td className="px-4 py-2">
                  <Select
                    value={rows[i]?.school ?? ""}
                    onValueChange={(v) =>
                      update(i, { school: v as "TRINITY" | "WHITGIFT" })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger
                      className="h-9 text-sm"
                      aria-label={`Sibling ${i + 1} school`}
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WHITGIFT" className="text-sm">
                        Whitgift
                      </SelectItem>
                      <SelectItem value="TRINITY" className="text-sm">
                        Trinity
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2">
                  <CurrencyInput
                    ariaLabel={`Sibling ${i + 1} net payable fees`}
                    value={rows[i]?.netPayableFees ?? 0}
                    disabled={readOnly}
                    onChange={(v) => update(i, { netPayableFees: v })}
                  />
                </td>
                {options.length > 0 && !readOnly && (
                  <td className="px-4 py-2">
                    <Select value={NONE} onValueChange={(v) => fillFromAccount(i, v)}>
                      <SelectTrigger
                        className="h-9 text-xs"
                        aria-label={`Fill sibling ${i + 1} from a bursary account`}
                      >
                        <SelectValue placeholder="Pick account…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE} className="text-xs">
                          Manual entry
                        </SelectItem>
                        {options.map((o) => (
                          <SelectItem
                            key={o.bursaryAccountId}
                            value={o.bursaryAccountId}
                            className="text-xs"
                          >
                            {o.childName} —{" "}
                            {o.school === "TRINITY" ? "Trinity" : "Whitgift"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                )}
              </tr>
            ))}
            <tr className="bg-slate-50/70">
              <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                SIBLINGS&apos; NET PAYABLE FEES
              </td>
              <td />
              <td className="px-4 py-2 text-right font-mono text-sm font-semibold text-primary-900">
                {new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP",
                }).format(rows.reduce((sum, r) => sum + (r.netPayableFees ?? 0), 0))}
              </td>
              {options.length > 0 && !readOnly && <td />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
