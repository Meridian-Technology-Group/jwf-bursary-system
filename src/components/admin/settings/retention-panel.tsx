/**
 * Settings → Retention (Epic 23 T10): what the DPO-signed rules will delete
 * next, by reference and due date, so a subject-access question ("when will
 * this be deleted?") can be answered. Read-only. Server component.
 */

import Link from "next/link";
import { RETENTION_ACTION_LABELS, RETENTION_RULE_LABELS } from "@/lib/retention/policy";
import type { ScheduledItem } from "@/lib/retention/schedule";

const fmt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(d) : "—";

export function RetentionPanel({ items, enabled }: { items: ScheduledItem[]; enabled: boolean }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p>
          <span className="font-medium">Rules (DPO, 16 Oct 2026).</span> Bursary account closed: form and documents 1 year
          after the closing date, the named assessment 6 years after. Unsuccessful application: form and documents at the
          close, the named assessment 6 years after. Erasure request: anonymised at once, the anonymous assessment 6 years
          after.
        </p>
        <p className="mt-2 font-medium">
          {enabled
            ? "Retention purging is ON: each step below runs on its date (weekly run)."
            : "Retention purging is OFF on this environment: nothing is deleted. The dates below are what would happen."}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Nothing scheduled: no closed accounts, closed applications or erasure requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Reference</th>
                <th className="py-2 pr-3 font-medium">Rule</th>
                <th className="py-2 pr-3 font-medium">Next step</th>
                <th className="py-2 pr-3 font-medium">Due</th>
                <th className="py-2 font-medium">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.applicationId}>
                  <td className="py-1.5 pr-3">
                    <Link href={`/applications/${i.applicationId}`} className="text-accent-700 underline-offset-2 hover:underline">
                      {i.reference}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-600">{i.plan.rule ? RETENTION_RULE_LABELS[i.plan.rule] : "—"}</td>
                  <td className="py-1.5 pr-3">{RETENTION_ACTION_LABELS[i.plan.action]}</td>
                  <td className={`py-1.5 pr-3 tabular-nums ${i.plan.due ? "font-semibold text-red-700" : ""}`}>
                    {fmt(i.plan.dueAt)}
                    {i.plan.due ? " (due)" : ""}
                  </td>
                  <td className="py-1.5 tabular-nums text-slate-500">{fmt(i.plan.anchor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
