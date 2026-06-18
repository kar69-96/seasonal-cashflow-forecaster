// Phase F — walk-forward (rolling-origin) calibration.
// A single holdout window is one noisy realization; coverage would swing with luck.
// Instead we re-forecast from many cutoffs across history and aggregate how often the
// realized path lands inside each central prediction interval. Points on the 45° line
// mean the bands contain reality as often as they claim.
import type { BacktestResult, CalibrationPoint, Scenario } from "@/domain/types";
import { buildInputs, type LedgerData } from "./index";
import { simulate } from "./simulate";
import { addDays, daysBetween } from "./dates";
import { percentile } from "./stats";

const NOMINAL_LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const MIN_TRAIN_DAYS = 365; // at least a year of history before each origin
const BACKTEST_PATHS = 2500;
const TARGET_ORIGINS = 7;

/** Realized daily balance trajectory over [origin, origin+H] from actual transactions. */
function actualTrajectory(
  data: LedgerData,
  origin: string,
  horizon: number,
  startBalance: number,
): number[] {
  const flow = new Array<number>(horizon + 1).fill(0);
  for (const t of data.transactions) {
    const idx = daysBetween(origin, t.date);
    if (idx >= 1 && idx <= horizon) flow[idx] += t.amount;
  }
  const balances = new Array<number>(horizon + 1);
  let bal = startBalance;
  for (let d = 0; d <= horizon; d++) {
    bal += flow[d];
    balances[d] = bal;
  }
  return balances;
}

function neutralScenario(base: Scenario, origin: string, horizon: number): Scenario {
  return {
    ...base,
    priceShockPct: 0,
    inputCostPct: 0,
    extraPaymentDelayDays: 0,
    creditLine: undefined,
    asOf: origin,
    horizonDays: horizon,
    paths: BACKTEST_PATHS,
  };
}

export function backtest(
  data: LedgerData,
  baseScenario: Scenario,
  seed: number,
  holdoutDays = 45,
): BacktestResult {
  const dates = data.transactions.map((t) => t.date).sort();
  const first = dates[0] ?? baseScenario.asOf;
  const last = dates[dates.length - 1] ?? baseScenario.asOf;
  const totalDays = daysBetween(first, last);
  const H = holdoutDays;

  // Spread origins between "one year trained" and "H days before the end".
  const span = totalDays - H - MIN_TRAIN_DAYS;
  const origins: string[] = [];
  if (span <= 0) {
    origins.push(addDays(last, -H)); // fall back to a single window on thin data
  } else {
    const step = Math.max(20, Math.floor(span / (TARGET_ORIGINS - 1)));
    for (let d = MIN_TRAIN_DAYS; d <= totalDays - H; d += step) {
      origins.push(addDays(first, d));
    }
  }

  const inside = NOMINAL_LEVELS.map(() => 0);
  let observations = 0;

  for (let o = 0; o < origins.length; o++) {
    const origin = origins[o];
    const train: LedgerData = {
      transactions: data.transactions.filter((t) => t.date <= origin),
      outstanding: [],
      paidHistory: [],
    };
    const scenario = neutralScenario(baseScenario, origin, H);
    const inputs = buildInputs(train, origin);
    const paths = simulate(inputs, scenario, seed ^ (o * 0x1000193));
    const actual = actualTrajectory(data, origin, H, baseScenario.startBalance);

    for (let d = 0; d <= H; d++) {
      const column = paths.map((p) => p[d]);
      observations += 1;
      for (let i = 0; i < NOMINAL_LEVELS.length; i++) {
        const c = NOMINAL_LEVELS[i];
        const lo = percentile(column, ((1 - c) / 2) * 100);
        const hi = percentile(column, ((1 + c) / 2) * 100);
        if (actual[d] >= lo && actual[d] <= hi) inside[i] += 1;
      }
    }
  }

  const points: CalibrationPoint[] = NOMINAL_LEVELS.map((nominal, i) => ({
    nominal,
    empirical: observations > 0 ? inside[i] / observations : 0,
  }));

  const p90 = points.find((p) => p.nominal === 0.9)!;
  const verdict =
    `Across ${origins.length} walk-forward origins (${H}-day horizons), bands are ` +
    `${calibrationLabel(p90)}: the 90% interval covered ${(p90.empirical * 100).toFixed(
      0,
    )}% of held-out days.`;

  return { points, holdoutDays: H, verdict };
}

function calibrationLabel(p: CalibrationPoint): string {
  const gap = Math.abs(p.empirical - p.nominal);
  if (gap <= 0.1) return "well-calibrated";
  if (p.empirical > p.nominal) return "conservative (wider than needed)";
  return "slightly overconfident";
}
