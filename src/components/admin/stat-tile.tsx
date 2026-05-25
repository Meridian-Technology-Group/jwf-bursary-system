/**
 * StatTile — shared dashboard / cockpit stat card.
 *
 * Pure server component (no client hooks). Extracted from `admin/page.tsx`,
 * where it lived inline. Behaviour for existing callers is unchanged; the
 * optional `delta` and `subCounts` props are additive and only render when
 * supplied (used later by the Round Cockpit).
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TileConfig {
  label: string;
  subLabel: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  borderAccent: string;
  href?: string;
}

/** A small year-on-year (or period-on-period) movement indicator. */
export interface StatTileDelta {
  value: number;
  direction: "up" | "down" | "neutral";
  /** Optional muted caption rendered after the value (e.g. "vs last year"). */
  label?: string;
}

/** A compact breakdown rendered on one line under the count. */
export interface StatTileSubCount {
  label: string;
  value: number | string;
}

const DELTA_ARROW: Record<StatTileDelta["direction"], string> = {
  up: "▲",
  down: "▼",
  neutral: "▬",
};

const DELTA_TONE: Record<StatTileDelta["direction"], string> = {
  up: "bg-emerald-50 text-emerald-700",
  down: "bg-red-50 text-red-600",
  neutral: "bg-slate-100 text-slate-500",
};

function DeltaBadge({ delta }: { delta: StatTileDelta }) {
  const sign = delta.value > 0 ? "+" : "";
  const ariaDirection =
    delta.direction === "up"
      ? "up"
      : delta.direction === "down"
        ? "down"
        : "no change";

  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
          DELTA_TONE[delta.direction]
        )}
        aria-label={`${ariaDirection} ${Math.abs(delta.value)}%${
          delta.label ? ` ${delta.label}` : ""
        }`}
      >
        <span aria-hidden="true">{DELTA_ARROW[delta.direction]}</span>
        <span aria-hidden="true">
          {sign}
          {delta.value}%
        </span>
      </span>
      {delta.label && (
        <span className="text-xs text-slate-400">{delta.label}</span>
      )}
    </span>
  );
}

export function StatTile({
  config,
  count,
  delta,
  subCounts,
}: {
  config: TileConfig;
  count: number | string;
  delta?: StatTileDelta;
  subCounts?: StatTileSubCount[];
}) {
  const Icon = config.icon;

  const inner = (
    <div
      className={cn(
        "group flex items-start gap-4 rounded-xl border bg-white p-6 shadow-sm transition-shadow",
        config.borderAccent,
        config.href ? "hover:shadow-md cursor-pointer" : "cursor-default"
      )}
    >
      {/* Icon badge */}
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
          config.iconBg
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-5 w-5", config.iconColor)} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-500">{config.label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-primary-900">
          {count}
          {delta && <DeltaBadge delta={delta} />}
        </p>
        {subCounts && subCounts.length > 0 && (
          <p className="mt-1 text-xs tabular-nums text-slate-400">
            {subCounts.map((sub, i) => (
              <span key={sub.label}>
                {i > 0 && <span className="mx-1 text-slate-300">·</span>}
                {sub.value} {sub.label}
              </span>
            ))}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">{config.subLabel}</p>
      </div>

      {/* Arrow for clickable tiles */}
      {config.href && (
        <ChevronRight
          className="h-4 w-4 shrink-0 self-center text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400"
          aria-hidden="true"
        />
      )}
    </div>
  );

  if (config.href) {
    return (
      <Link
        href={config.href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 rounded-xl"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}
