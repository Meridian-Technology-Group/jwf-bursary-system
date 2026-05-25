/**
 * DeltaBadge — a small presentational badge for a year-on-year (or any prior
 * comparison) delta. Renders e.g. "▲ +12%" in green (up), red (down) or slate
 * (neutral).
 *
 * Pure presentational Server Component — no hooks, no `"use client"`. It does
 * NOT compute deltas; callers pass a pre-computed `value` and `direction`.
 *
 * Wired with real cross-round values in Stage F (Round Cockpit #18). Created
 * here so the markup/contract exists; usage in this PR is limited to cases with
 * a sensible in-PR comparison.
 */

import { cn } from "@/lib/utils";

export interface DeltaBadgeProps {
  /** Magnitude of the change (already computed by the caller). */
  value: number;
  /** Visual + semantic direction. `neutral` renders with no sign emphasis. */
  direction: "up" | "down" | "neutral";
  /** Optional unit suffix, e.g. "%". */
  suffix?: string;
}

const GLYPH: Record<DeltaBadgeProps["direction"], string> = {
  up: "▲",
  down: "▼",
  neutral: "▬",
};

const STYLES: Record<DeltaBadgeProps["direction"], string> = {
  up: "bg-green-50 text-green-700",
  down: "bg-red-50 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
};

const WORD: Record<DeltaBadgeProps["direction"], string> = {
  up: "up",
  down: "down",
  neutral: "no change",
};

export function DeltaBadge({ value, direction, suffix = "" }: DeltaBadgeProps) {
  // Signed numeral: + for up, − for down, none for neutral.
  const magnitude = Math.abs(value);
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "";
  const numeral = `${sign}${magnitude}${suffix}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        STYLES[direction],
      )}
      aria-label={`${WORD[direction]} ${magnitude}${suffix}`}
    >
      <span aria-hidden="true">{GLYPH[direction]}</span>
      <span aria-hidden="true">{numeral}</span>
    </span>
  );
}
