"use client";
// Three decision cards: probability of shortfall, the cash-trough date, and the
// credit line that covers 95% of simulated outcomes.
import type { SimResult } from "@/domain/types";
import { formatDate, formatPct, formatUSD } from "./format";

interface Props {
  result: SimResult;
}

function riskTone(p: number): { color: string; label: string } {
  if (p >= 0.5) return { color: "text-red-700", label: "high" };
  if (p >= 0.2) return { color: "text-amber-600", label: "moderate" };
  return { color: "text-green-700", label: "low" };
}

export function HeadlineMetrics({ result }: Props) {
  const tone = riskTone(result.pShortfall);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card
        label="Probability of shortfall"
        sub="paths dipping below the operating buffer"
      >
        <span className={`text-4xl font-semibold tabular-nums ${tone.color}`}>
          {formatPct(result.pShortfall)}
        </span>
        <span className={`ml-2 text-sm font-medium ${tone.color}`}>{tone.label}</span>
      </Card>

      <Card label="Cash-trough date" sub="tightest point during the grow-out">
        <span className="text-3xl font-semibold text-stone-800">
          {formatDate(result.troughDate)}
        </span>
      </Card>

      <Card label="Recommended credit line" sub="covers 95% of simulated outcomes">
        <span className="text-4xl font-semibold tabular-nums text-stone-800">
          {formatUSD(result.recommendedLine)}
        </span>
      </Card>
    </div>
  );
}

function Card({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className="mt-3 flex items-baseline">{children}</div>
      <div className="mt-2 text-xs text-stone-400">{sub}</div>
    </div>
  );
}
