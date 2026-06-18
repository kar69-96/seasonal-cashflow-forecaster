// Phase E — turn the path ensemble into decision-grade numbers.
import type { BandKey, Scenario, SimResult } from "@/domain/types";
import { dateRange } from "./dates";
import { percentile } from "./stats";

const BAND_PCTS: Record<BandKey, number> = {
  p5: 5,
  p25: 25,
  p50: 50,
  p75: 75,
  p95: 95,
};

/**
 * Compute percentile bands, shortfall probability, trough date, and the
 * recommended credit line from a paths × days balance matrix.
 */
export function computeMetrics(paths: number[][], scenario: Scenario): SimResult {
  const numPaths = paths.length;
  const days = paths[0]?.length ?? 0;
  const dayLabels = dateRange(scenario.asOf, scenario.horizonDays).slice(0, days);

  const bands: Record<BandKey, number[]> = {
    p5: [],
    p25: [],
    p50: [],
    p75: [],
    p95: [],
  };

  // Per-day shortfall frequency (how often the balance is below the buffer that day).
  const shortfallByDay = new Array<number>(days).fill(0);

  for (let d = 0; d < days; d++) {
    const column = new Array<number>(numPaths);
    for (let p = 0; p < numPaths; p++) {
      const v = paths[p][d];
      column[p] = v;
      if (v < scenario.buffer) shortfallByDay[d] += 1;
    }
    for (const key of Object.keys(bands) as BandKey[]) {
      bands[key].push(percentile(column, BAND_PCTS[key]));
    }
  }

  // P(shortfall): fraction of paths whose *minimum* balance dips below the buffer.
  let pathsWithShortfall = 0;
  const maxDrawdowns = new Array<number>(numPaths);
  const endingBalances = new Array<number>(numPaths);
  for (let p = 0; p < numPaths; p++) {
    let minBal = Infinity;
    for (let d = 0; d < days; d++) minBal = Math.min(minBal, paths[p][d]);
    if (minBal < scenario.buffer) pathsWithShortfall += 1;
    maxDrawdowns[p] = Math.max(0, scenario.buffer - minBal);
    endingBalances[p] = paths[p][days - 1];
  }

  // Trough: day with the highest shortfall frequency (ties -> earliest).
  let troughIndex = 0;
  for (let d = 1; d < days; d++) {
    if (shortfallByDay[d] > shortfallByDay[troughIndex]) troughIndex = d;
  }
  // If nothing ever breaches the buffer, fall back to the day of lowest median.
  if (shortfallByDay[troughIndex] === 0) {
    troughIndex = bands.p50.reduce(
      (best, v, i, arr) => (v < arr[best] ? i : best),
      0,
    );
  }

  return {
    days: dayLabels,
    bands,
    pShortfall: numPaths > 0 ? pathsWithShortfall / numPaths : 0,
    troughDate: dayLabels[troughIndex] ?? scenario.asOf,
    troughIndex,
    // A line of this size covers 95% of simulated drawdowns below the buffer.
    recommendedLine: percentile(maxDrawdowns, 95),
    endingBalances,
  };
}
