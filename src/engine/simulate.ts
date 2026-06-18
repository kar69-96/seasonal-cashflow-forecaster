// Phase D — Monte Carlo simulation of daily cash balance.
// Pure and deterministic given a seed: same inputs + seed => identical paths.
import type {
  OutstandingItem,
  PaymentTiming,
  RecurringStream,
  Scenario,
  SeasonalStream,
} from "@/domain/types";
import { isRevenue, isVariableCost } from "./categories";
import { addDays, daysBetween, monthOf } from "./dates";
import { mulberry32, samplePositive, type Rng } from "./rng";
import { sampleSettlementDate } from "./paymentTiming";

/** Std of the per-path common cost factor (year-quality / input-inflation regime). */
const COMMON_COST_CV = 0.24;

export interface SimInputs {
  recurring: readonly RecurringStream[];
  seasonal: readonly SeasonalStream[];
  outstanding: readonly OutstandingItem[];
  timing: PaymentTiming;
}

/** Apply the relevant scenario shock to a signed amount, given its category role. */
function shockAmount(amount: number, category: string, scenario: Scenario): number {
  if (isRevenue(category as never)) return amount * (1 + scenario.priceShockPct);
  if (isVariableCost(category as never)) return amount * (1 + scenario.inputCostPct);
  return amount;
}

interface MonthWindow {
  month: number; // 1..12
  startIdx: number; // first in-horizon day index for this month
  endIdx: number; // last in-horizon day index for this month
}

/** Enumerate the calendar months spanned by the horizon, with day-index ranges. */
function monthWindows(asOf: string, horizonDays: number): MonthWindow[] {
  const windows: MonthWindow[] = [];
  let i = 0;
  while (i <= horizonDays) {
    const date = addDays(asOf, i);
    const month = monthOf(date);
    const startIdx = i;
    while (i <= horizonDays && monthOf(addDays(asOf, i)) === month) i++;
    windows.push({ month, startIdx, endIdx: i - 1 });
  }
  return windows;
}

/**
 * Deterministic per-day net flow shared across all paths:
 * recurring streams (placed on their occurrence dates) + known payables.
 */
function deterministicDaily(
  inputs: SimInputs,
  scenario: Scenario,
  days: number,
): number[] {
  const det = new Array<number>(days).fill(0);
  const { asOf, horizonDays } = scenario;

  for (const stream of inputs.recurring) {
    let date = stream.nextDate;
    let guard = 0;
    while (daysBetween(asOf, date) <= horizonDays && guard++ < 2000) {
      const idx = daysBetween(asOf, date);
      if (idx >= 0 && idx < days) {
        det[idx] += shockAmount(stream.amount, stream.category, scenario);
      }
      date = addDays(date, stream.periodDays);
    }
  }

  // Known payables settle on their due date (negative amounts).
  for (const item of inputs.outstanding) {
    if (item.kind !== "payable") continue;
    const idx = daysBetween(asOf, item.dueDate);
    if (idx >= 0 && idx < days) det[idx] += item.amount;
  }

  return det;
}

/** Add this path's stochastic seasonal flows into the per-day flow array (in place). */
function addSeasonalFlows(
  flow: number[],
  inputs: SimInputs,
  scenario: Scenario,
  windows: readonly MonthWindow[],
  rng: Rng,
  costFactor: number,
): void {
  for (const stream of inputs.seasonal) {
    // A common "year quality" factor lifts/lowers all variable costs together
    // (a drought year raises feed AND fuel AND vet). This non-diversifiable variance
    // is what makes real cumulative forecasts uncertain.
    const factor = stream.sign < 0 ? costFactor : 1;
    for (const w of windows) {
      const stat = stream.monthlyProfile[w.month - 1];
      if (!stat || stat.pOccur <= 0 || stat.mean <= 0) continue;
      if (rng.next() >= stat.pOccur) continue;
      const magnitude = samplePositive(rng, stat.mean, stat.std) * factor;
      const signed = stream.sign * magnitude;
      const shocked = shockAmount(signed, stream.category, scenario);
      const span = w.endIdx - w.startIdx;
      const day = w.startIdx + (span > 0 ? Math.floor(rng.next() * (span + 1)) : 0);
      flow[day] += shocked;
    }
  }
}

/** Add this path's receivable settlements (sampled timing). */
function addReceivableFlows(
  flow: number[],
  inputs: SimInputs,
  scenario: Scenario,
  days: number,
  rng: Rng,
): void {
  for (const item of inputs.outstanding) {
    if (item.kind !== "receivable") continue;
    const settle = sampleSettlementDate(
      rng,
      item.dueDate,
      inputs.timing,
      scenario.extraPaymentDelayDays,
    );
    const idx = daysBetween(scenario.asOf, settle);
    if (idx >= 0 && idx < days) flow[idx] += item.amount;
  }
}

/**
 * Run the simulation. Returns a paths × (horizonDays + 1) matrix of end-of-day balances.
 */
export function simulate(inputs: SimInputs, scenario: Scenario, seed: number): number[][] {
  const days = scenario.horizonDays + 1;
  const windows = monthWindows(scenario.asOf, scenario.horizonDays);
  const det = deterministicDaily(inputs, scenario, days);
  const dailyRate = scenario.creditLine
    ? scenario.creditLine.aprPct / 100 / 365
    : 0;

  const paths: number[][] = [];
  for (let p = 0; p < scenario.paths; p++) {
    // Per-path RNG stream keyed off the master seed for reproducibility.
    const rng = mulberry32((seed ^ (p * 0x9e3779b1)) >>> 0);

    // Draw the common cost factor once per path (clamped to stay positive).
    const costFactor = Math.max(0.4, 1 + COMMON_COST_CV * rng.normal());

    const flow = det.slice();
    addSeasonalFlows(flow, inputs, scenario, windows, rng, costFactor);
    addReceivableFlows(flow, inputs, scenario, days, rng);

    const balances = new Array<number>(days);
    let balance = scenario.startBalance;
    let drawn = 0;

    for (let d = 0; d < days; d++) {
      balance += flow[d];

      if (scenario.creditLine) {
        // Accrue interest on the outstanding draw.
        balance -= drawn * dailyRate;
        // Draw to defend the buffer, up to the remaining limit.
        if (balance < scenario.buffer) {
          const room = scenario.creditLine.limit - drawn;
          const draw = Math.min(room, scenario.buffer - balance);
          if (draw > 0) {
            balance += draw;
            drawn += draw;
          }
        } else if (drawn > 0 && balance > scenario.buffer) {
          // Repay from surplus above the buffer.
          const repay = Math.min(drawn, balance - scenario.buffer);
          balance -= repay;
          drawn -= repay;
        }
      }

      balances[d] = balance;
    }
    paths.push(balances);
  }

  return paths;
}

/** Expose the month-window helper for reuse/testing. */
export { monthWindows, deterministicDaily };
