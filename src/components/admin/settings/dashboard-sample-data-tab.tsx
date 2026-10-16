"use client";

/**
 * Settings → Dashboard sample data (Epic 23 T9, D-18). One small form per
 * illustrative dashboard panel. The dashboard shows these figures, badged
 * "Illustrative data", only until the panel's first real data arrives.
 */

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDashboardSampleAction } from "@/app/(admin)/settings/actions";
import { SAMPLE_TITLES, type SampleKey, type SamplePayloads } from "@/lib/dashboard/sample-data";

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string };

function useSave(key: SampleKey) {
  const [isPending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const save = (payload: unknown) =>
    startTransition(async () => {
      const r = await saveDashboardSampleAction(key, payload);
      setStatus(r.success ? { kind: "saved" } : { kind: "error", message: r.error });
    });
  return { isPending, status, save, reset: () => setStatus({ kind: "idle" }) };
}

function Footer({ isPending, status, onSave }: { isPending: boolean; status: Status; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button type="button" size="sm" onClick={onSave} disabled={isPending} className="gap-2">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Save
      </Button>
      {status.kind === "saved" && <span className="text-sm text-success-600">Saved. The dashboard uses these until real data exists.</span>}
      {status.kind === "error" && <span className="text-sm text-red-600">{status.message}</span>}
    </div>
  );
}

function RowsForm({
  sampleKey,
  initial,
  valueLabel,
  max,
  toInput,
  fromInput,
}: {
  sampleKey: "closed_reasons_top5" | "yoy_changes_top10";
  initial: { label: string; value: number }[];
  valueLabel: string;
  max: number;
  toInput: (v: number) => string;
  fromInput: (s: string) => number;
}) {
  const [rows, setRows] = React.useState(initial.map((r) => ({ label: r.label, value: toInput(r.value) })));
  const { isPending, status, save, reset } = useSave(sampleKey);
  const set = (i: number, k: "label" | "value", v: string) => {
    reset();
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  };
  const payload = () => ({
    rows: rows
      .filter((r) => r.label.trim())
      .map((r) =>
        sampleKey === "closed_reasons_top5"
          ? { label: r.label.trim(), share: fromInput(r.value) }
          : { label: r.label.trim(), count: fromInput(r.value) },
      ),
  });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_8rem_2rem] gap-2 text-xs font-medium text-slate-500">
        <span>Label</span>
        <span>{valueLabel}</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_8rem_2rem] items-center gap-2">
          <Input aria-label={`Row ${i + 1} label`} value={r.label} onChange={(e) => set(i, "label", e.target.value)} />
          <Input
            aria-label={`Row ${i + 1} ${valueLabel}`}
            inputMode="decimal"
            value={r.value}
            onChange={(e) => set(i, "value", e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove row ${i + 1}`}
            onClick={() => {
              reset();
              setRows((rs) => rs.filter((_, j) => j !== i));
            }}
          >
            <Trash2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </Button>
        </div>
      ))}
      {rows.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            reset();
            setRows((rs) => [...rs, { label: "", value: "0" }]);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add a row
        </Button>
      )}
      <Footer isPending={isPending} status={status} onSave={() => save(payload())} />
    </div>
  );
}

function SpendForm({ initial }: { initial: SamplePayloads["rolling_committed_spend"] }) {
  const [v, setV] = React.useState({ exOp: String(initial.exOp), ts: String(initial.ts), ws: String(initial.ws) });
  const { isPending, status, save, reset } = useSave("rolling_committed_spend");
  const fields: { k: keyof typeof v; label: string }[] = [
    { k: "exOp", label: "ex-OP (£, before VAT)" },
    { k: "ts", label: "TS (£, before VAT)" },
    { k: "ws", label: "WS (£, before VAT)" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.k} className="space-y-1">
            <Label htmlFor={`spend-${f.k}`}>{f.label}</Label>
            <Input
              id={`spend-${f.k}`}
              inputMode="decimal"
              value={v[f.k]}
              onChange={(e) => {
                reset();
                setV((x) => ({ ...x, [f.k]: e.target.value }));
              }}
            />
          </div>
        ))}
      </div>
      <Footer
        isPending={isPending}
        status={status}
        onSave={() => save({ exOp: Number(v.exOp.replace(/[£,\s]/g, "")), ts: Number(v.ts.replace(/[£,\s]/g, "")), ws: Number(v.ws.replace(/[£,\s]/g, "")) })}
      />
    </div>
  );
}

export function DashboardSampleDataTab({ samples }: { samples: SamplePayloads }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        These figures stand in on the dashboard, marked &ldquo;Illustrative data&rdquo;, until the
        first real data for that panel exists. They are not used anywhere else.
      </p>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-primary-900">{SAMPLE_TITLES.closed_reasons_top5}</h3>
        <RowsForm
          sampleKey="closed_reasons_top5"
          initial={samples.closed_reasons_top5.rows.map((r) => ({ label: r.label, value: r.share }))}
          valueLabel="Share (%)"
          max={5}
          toInput={(share) => String(Math.round(share * 1000) / 10)}
          fromInput={(s) => Number(s.replace(/[%\s]/g, "")) / 100}
        />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-primary-900">{SAMPLE_TITLES.yoy_changes_top10}</h3>
        <RowsForm
          sampleKey="yoy_changes_top10"
          initial={samples.yoy_changes_top10.rows.map((r) => ({ label: r.label, value: r.count }))}
          valueLabel="Recurrences"
          max={10}
          toInput={(n) => String(n)}
          fromInput={(s) => Number(s.replace(/[,\s]/g, ""))}
        />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-primary-900">{SAMPLE_TITLES.rolling_committed_spend}</h3>
        <SpendForm initial={samples.rolling_committed_spend} />
      </section>
    </div>
  );
}
