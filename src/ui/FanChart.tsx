"use client";
// Percentile fan chart: nested confidence bands + median, the buffer line, and the
// trough marker. The spring grow-out cash valley before the hens come into lay is the payload.
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SimResult } from "@/domain/types";
import { formatShortDate, formatUSD } from "./format";

interface Props {
  result: SimResult;
  buffer: number;
}

interface Row {
  date: string;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  // Stacked offsets: outer band base + thickness, inner band base + thickness.
  outerBase: number;
  outerSpan: number;
  innerBase: number;
  innerSpan: number;
}

function toRows(result: SimResult): Row[] {
  return result.days.map((date, i) => {
    const { p5, p25, p50, p75, p95 } = result.bands;
    return {
      date,
      p5: p5[i],
      p25: p25[i],
      p50: p50[i],
      p75: p75[i],
      p95: p95[i],
      outerBase: p5[i],
      outerSpan: p95[i] - p5[i],
      innerBase: p25[i],
      innerSpan: p75[i] - p25[i],
    };
  });
}

export function FanChart({ result, buffer }: Props) {
  const rows = toRows(result);
  const troughDate = result.troughDate;

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="outerBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15803d" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#15803d" stopOpacity={0.18} />
            </linearGradient>
            <linearGradient id="innerBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15803d" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#15803d" stopOpacity={0.34} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 11, fill: "#78716c" }}
            minTickGap={48}
            stroke="#d6d3d1"
          />
          <YAxis
            tickFormatter={(v) => formatUSD(v, { compact: true })}
            tick={{ fontSize: 11, fill: "#78716c" }}
            width={56}
            stroke="#d6d3d1"
          />
          <Tooltip content={<FanTooltip />} />

          {/* Stacked areas: invisible base, then visible band thickness. */}
          <Area
            dataKey="outerBase"
            stackId="outer"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            activeDot={false}
            legendType="none"
          />
          <Area
            dataKey="outerSpan"
            stackId="outer"
            stroke="none"
            fill="url(#outerBand)"
            name="p5–p95"
            isAnimationActive
            animationDuration={300}
            activeDot={false}
          />
          <Area
            dataKey="innerBase"
            stackId="inner"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            activeDot={false}
            legendType="none"
          />
          <Area
            dataKey="innerSpan"
            stackId="inner"
            stroke="none"
            fill="url(#innerBand)"
            name="p25–p75"
            isAnimationActive
            animationDuration={300}
            activeDot={false}
          />

          <Line
            dataKey="p50"
            stroke="#14532d"
            strokeWidth={2}
            dot={false}
            name="median"
            isAnimationActive
            animationDuration={300}
          />

          <ReferenceLine
            y={buffer}
            stroke="#b91c1c"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: `buffer ${formatUSD(buffer, { compact: true })}`,
              position: "insideBottomRight",
              fontSize: 11,
              fill: "#b91c1c",
            }}
          />
          <ReferenceLine
            x={troughDate}
            stroke="#a16207"
            strokeDasharray="3 3"
            label={{
              value: "trough",
              position: "top",
              fontSize: 11,
              fill: "#a16207",
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { payload: Row }[];
}

function FanTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const lines: [string, number][] = [
    ["p95", row.p95],
    ["p75", row.p75],
    ["median", row.p50],
    ["p25", row.p25],
    ["p5", row.p5],
  ];
  return (
    <div className="rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium text-stone-700">
        {label ? formatShortDate(label) : ""}
      </div>
      {lines.map(([name, value]) => (
        <div key={name} className="flex justify-between gap-4 tabular-nums">
          <span className="text-stone-500">{name}</span>
          <span className="font-medium text-stone-800">{formatUSD(value)}</span>
        </div>
      ))}
    </div>
  );
}
