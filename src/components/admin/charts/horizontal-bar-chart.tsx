"use client";

/**
 * Reusable horizontal bar chart using recharts BarChart with layout="vertical".
 *
 * Design system: Navy (#0D1B2A) bars, gold (#B8862A) for highlighted/attention bars.
 * Shows data labels on each bar with count and optional percentage.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BarChartDataItem {
  label: string;
  count: number;
  pct?: number;
  /** When true, renders this bar in gold instead of navy */
  highlight?: boolean;
}

interface HorizontalBarChartProps {
  data: BarChartDataItem[];
  /** Height of the chart in pixels (default: 280) */
  height?: number;
  /** Show percentage labels alongside counts (default: false) */
  showPct?: boolean;
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const NAVY = "#0D1B2A";
const GOLD = "#B8862A";

// ─── Custom label ─────────────────────────────────────────────────────────────

interface LabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  index?: number;
  data?: BarChartDataItem[];
  showPct?: boolean;
}

function BarLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  value = 0,
  index = 0,
  data = [],
  showPct = false,
}: LabelProps) {
  const item = data[index];
  if (!item) return null;

  const labelText =
    showPct && item.pct !== undefined
      ? `${value} (${item.pct}%)`
      : String(value);

  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dominantBaseline="central"
      fontSize={12}
      fill="#64748b"
      fontFamily="Inter, sans-serif"
    >
      {labelText}
    </text>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  showPct,
}: TooltipContentProps<number, string> & { showPct: boolean }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const item = entry?.payload as BarChartDataItem | undefined;
  const count = entry?.value ?? 0;

  return (
    <div
      style={{
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        fontSize: "12px",
        fontFamily: "Inter, sans-serif",
        background: "#fff",
        padding: "8px 12px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 2, color: "#1e293b" }}>{label}</p>
      <p style={{ color: "#64748b" }}>
        {showPct && item?.pct !== undefined
          ? `${count} (${item.pct}%)`
          : count}
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HorizontalBarChart({
  data,
  height = 280,
  showPct = false,
}: HorizontalBarChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50"
        style={{ height }}
        aria-label="No data available"
      >
        <p className="text-sm text-slate-400">No data for this period</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  // Add right-margin to accommodate labels
  const rightMargin = showPct ? 80 : 56;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: rightMargin, bottom: 4, left: 0 }}
        aria-label="Horizontal bar chart"
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis
          type="number"
          domain={[0, maxCount]}
          tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "Inter, sans-serif" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={96}
          tick={{ fontSize: 12, fill: "#475569", fontFamily: "Inter, sans-serif" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.08)" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => <CustomTooltip {...props} showPct={showPct} />}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.highlight ? GOLD : NAVY}
              opacity={entry.count === 0 ? 0.25 : 1}
            />
          ))}
          <LabelList
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => (
              <BarLabel
                {...props}
                data={data}
                showPct={showPct}
              />
            )}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
