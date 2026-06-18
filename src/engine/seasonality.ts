// Phase B — extract a seasonal *shape* from variable flows.
// Honest framing: with 1–3 years of books, annual ACF is weak, so we estimate a
// monthly profile (occurrence prob + magnitude dist) and let Monte Carlo carry the
// uncertainty rather than over-fitting a precise periodic curve.
import type { Category, MonthStat, SeasonalStream, Transaction } from "@/domain/types";
import { isRevenue } from "./categories";
import { mean, std } from "./stats";

/** Minimum coefficient of variation for monthly magnitudes (thin-data uncertainty floor). */
const MIN_MONTH_CV = 0.35;

/**
 * Autocorrelation of a numeric series at lag k.
 * acf(k) = Σ (x_t - x̄)(x_{t-k} - x̄) / Σ (x_t - x̄)²
 */
export function autocorrelation(series: readonly number[], lag: number): number {
  const n = series.length;
  if (lag <= 0 || lag >= n) return 0;
  const m = mean(series);
  let num = 0;
  let den = 0;
  for (let t = 0; t < n; t++) {
    den += (series[t] - m) ** 2;
    if (t >= lag) num += (series[t] - m) * (series[t - lag] - m);
  }
  return den === 0 ? 0 : num / den;
}

/** Find the lag (within candidates) with the strongest positive autocorrelation. */
export function dominantPeriod(
  series: readonly number[],
  candidateLags: readonly number[],
): { lag: number; strength: number } {
  let best = { lag: 0, strength: -Infinity };
  for (const lag of candidateLags) {
    const strength = autocorrelation(series, lag);
    if (strength > best.strength) best = { lag, strength };
  }
  return best.strength === -Infinity ? { lag: 0, strength: 0 } : best;
}

/** Build a 12-entry monthly profile from a category's transactions. */
export function monthlyProfile(
  txns: readonly Transaction[],
  exposure: readonly number[],
): MonthStat[] {
  // Aggregate to a per-(year, month) TOTAL first, so the profile models the monthly cash
  // *volume* of a category regardless of how it's recorded — one monthly lump or hundreds
  // of small daily transactions both reduce to the same monthly total.
  const byYearMonth = new Map<string, number>();
  for (const t of txns) {
    const key = t.date.slice(0, 7); // 'YYYY-MM'
    byYearMonth.set(key, (byYearMonth.get(key) ?? 0) + Math.abs(t.amount));
  }

  // Collect the monthly totals grouped by calendar month.
  const totalsByMonth: number[][] = Array.from({ length: 12 }, () => []);
  for (const [key, total] of byYearMonth) {
    const m = parseInt(key.slice(5, 7), 10);
    totalsByMonth[m - 1].push(total);
  }

  const profile: MonthStat[] = [];
  for (let m = 1; m <= 12; m++) {
    const totals = totalsByMonth[m - 1];
    // Occurrence probability = months-with-a-flow / times that calendar month was in the
    // data window, so a category that posts every year in month m gets pOccur ≈ 1.
    const exp = Math.max(1, exposure[m - 1]);
    const pOccur = Math.min(1, totals.length / exp);
    const mu = totals.length > 0 ? mean(totals) : 0;
    const sampleStd = totals.length > 1 ? std(totals) : 0;
    // Thin-data variance floor: with few years of books the per-month sample std
    // understates real spread, so the Monte Carlo carries honest uncertainty.
    profile.push({
      month: m,
      pOccur,
      mean: mu,
      std: mu > 0 ? Math.max(sampleStd, MIN_MONTH_CV * mu) : 0,
    });
  }
  return profile;
}

/** Daily net-flow series for a category, used for autocorrelation diagnostics. */
function dailyNetSeries(txns: readonly Transaction[]): number[] {
  if (txns.length === 0) return [];
  const sorted = [...txns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const start = new Date(`${sorted[0].date}T00:00:00.000Z`).getTime();
  const end = new Date(`${sorted[sorted.length - 1].date}T00:00:00.000Z`).getTime();
  const days = Math.round((end - start) / 86_400_000) + 1;
  const series = new Array<number>(Math.max(days, 1)).fill(0);
  for (const t of sorted) {
    const idx = Math.round(
      (new Date(`${t.date}T00:00:00.000Z`).getTime() - start) / 86_400_000,
    );
    series[idx] += Math.abs(t.amount);
  }
  return series;
}

const ANNUAL_LAGS = [350, 360, 365, 370, 380];
const MONTHLY_LAGS = [28, 30, 31];

/**
 * Build seasonal streams (one per category present among the seasonal candidates).
 * Pure: derives everything from the input transactions.
 */
export function buildSeasonalStreams(
  seasonalTxns: readonly Transaction[],
): SeasonalStream[] {
  const byCategory = new Map<Category, Transaction[]>();
  for (const t of seasonalTxns) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  // Exposure is shared across categories: how many times each calendar month falls
  // inside the overall data window.
  const exposure = monthExposure(seasonalTxns);

  const streams: SeasonalStream[] = [];
  for (const [category, txns] of byCategory) {
    const series = dailyNetSeries(txns);
    const annual = dominantPeriod(series, ANNUAL_LAGS);
    const monthly = dominantPeriod(series, MONTHLY_LAGS);
    const dominant = annual.strength >= monthly.strength ? annual : monthly;
    streams.push({
      category,
      sign: isRevenue(category) ? 1 : -1,
      monthlyProfile: monthlyProfile(txns, exposure),
      dominantPeriodDays: dominant.lag || 365,
    });
  }
  return streams;
}

/** Count how many times each calendar month (1..12) appears in the data's date span. */
export function monthExposure(txns: readonly Transaction[]): number[] {
  const exposure = new Array<number>(12).fill(0);
  if (txns.length === 0) return exposure;
  const dates = txns.map((t) => t.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const firstIdx =
    parseInt(first.slice(0, 4), 10) * 12 + (parseInt(first.slice(5, 7), 10) - 1);
  const lastIdx =
    parseInt(last.slice(0, 4), 10) * 12 + (parseInt(last.slice(5, 7), 10) - 1);
  for (let idx = firstIdx; idx <= lastIdx; idx++) {
    exposure[idx % 12] += 1;
  }
  return exposure;
}
