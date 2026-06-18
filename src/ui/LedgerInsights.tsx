"use client";
// Makes the engine's decomposition visible: what it classified as fixed recurring,
// what it routed to the seasonal model, the known AR/AP, and the payment-timing fit.
import type { OutstandingItem } from "@/domain/types";
import type { SimInputs } from "@/engine";
import { formatDate, formatUSD } from "./format";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface Props {
  inputs: SimInputs;
  outstanding: OutstandingItem[];
}

export function LedgerInsights({ inputs, outstanding }: Props) {
  const receivables = outstanding.filter((o) => o.kind === "receivable");
  const payables = outstanding.filter((o) => o.kind === "payable");

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-stone-700">Sources</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section>
          <Heading>Fixed obligations</Heading>
          <p className="mb-2 text-xs text-stone-400">
            Clean recurrence (Phase A) — modeled deterministically.
          </p>
          <ul className="space-y-1.5">
            {inputs.recurring.map((r) => (
              <li key={r.vendor} className="flex justify-between text-sm">
                <span className="text-stone-600">{r.vendor}</span>
                <span className="tabular-nums text-stone-800">
                  {formatUSD(r.amount)}/{Math.round(r.periodDays)}d
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <Heading>Seasonal streams</Heading>
          <p className="mb-2 text-xs text-stone-400">
            Variable / price-driven (Phase B) — simulated stochastically.
          </p>
          <ul className="space-y-1.5">
            {inputs.seasonal
              .map((s) => {
                const peak = s.monthlyProfile.reduce(
                  (best, m) => (m.mean * m.pOccur > best.mean * best.pOccur ? m : best),
                  s.monthlyProfile[0],
                );
                return { stream: s, peak, weight: peak.mean * peak.pOccur };
              })
              .sort((a, b) => b.weight - a.weight)
              .slice(0, 8)
              .map(({ stream: s, peak }) => (
                <li key={s.category} className="flex justify-between text-sm">
                  <span className="text-stone-600">
                    {s.sign > 0 ? "▲" : "▼"} {labelCategory(s.category)}
                  </span>
                  <span className="text-stone-500">peak {MONTH_NAMES[peak.month - 1]}</span>
                </li>
              ))}
          </ul>
        </section>

        <section>
          <Heading>Outstanding & timing</Heading>
          <p className="mb-2 text-xs text-stone-400">
            Known AR/AP, settled with the fitted late-payment curve (Phase C).
          </p>
          <ul className="space-y-1.5">
            {receivables.map((r) => (
              <li key={r.id} className="flex justify-between text-sm">
                <span className="text-green-700">AR due {formatDate(r.dueDate)}</span>
                <span className="tabular-nums text-stone-800">{formatUSD(r.amount)}</span>
              </li>
            ))}
            {payables.map((p) => (
              <li key={p.id} className="flex justify-between text-sm">
                <span className="text-red-600">AP due {formatDate(p.dueDate)}</span>
                <span className="tabular-nums text-stone-800">{formatUSD(p.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-stone-100 pt-1.5 text-sm">
              <span className="text-stone-500">avg days late</span>
              <span className="tabular-nums text-stone-700">
                {inputs.timing.meanDaysLate.toFixed(0)} days
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
      {children}
    </h3>
  );
}

function labelCategory(c: string): string {
  return c.replace(/_/g, " ");
}
