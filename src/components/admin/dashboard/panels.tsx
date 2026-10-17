/**
 * BURSARY ACTIVITY DASHBOARD building blocks (Epic 23 T9): a panel card with
 * her heading (and an "Illustrative data" badge while it shows sample
 * figures), a per-school table and a label/value list. Server components;
 * tables rather than charts, as her mock-up draws them.
 */

import Link from "next/link";
import type { School } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SCHOOL_SHORT, type PerSchool } from "@/lib/dashboard/shape";

export const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

export const longDate = (d: Date | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(d)
    : "—";

export function IllustrativeBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-accent-400 bg-accent-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-accent-700">
      Illustrative data
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  illustrative = false,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  illustrative?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary-900">{title}</CardTitle>
          {illustrative && <IllustrativeBadge />}
        </div>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </CardHeader>
      <CardContent className="flex-1 space-y-4 pt-0 text-sm">{children}</CardContent>
    </Card>
  );
}

export function BandHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b-2 border-accent-600 pb-1 font-serif text-lg font-semibold uppercase tracking-wide text-primary-900">
      {children}
    </h2>
  );
}

export function KeyValues({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-1.5">
          <dt className="text-slate-600">{r.label}</dt>
          <dd className="shrink-0 font-semibold tabular-nums text-primary-900">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface PerSchoolRow {
  label: string;
  values: PerSchool;
  /** Link a count to a filtered list (per school), where an exact filter exists. */
  href?: (school: School) => string;
  emphasis?: boolean;
}

export function PerSchoolTable({ schools, rows, format = String }: { schools: School[]; rows: PerSchoolRow[]; format?: (n: number) => string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-slate-500">
          <th className="py-1 text-left font-medium" />
          {schools.map((s) => (
            <th key={s} className="w-16 py-1 text-right font-medium">
              {SCHOOL_SHORT[s]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.label} className={cn(r.emphasis && "font-semibold text-primary-900")}>
            <td className="py-1.5 pr-2 text-slate-600">{r.label}</td>
            {schools.map((s) => (
              <td key={s} className="py-1.5 text-right tabular-nums">
                {r.href && r.values[s] > 0 ? (
                  <Link href={r.href(s)} className="text-accent-700 underline-offset-2 hover:underline">
                    {format(r.values[s])}
                  </Link>
                ) : (
                  format(r.values[s])
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
