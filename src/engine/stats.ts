// Pure statistical helpers. No mutation of inputs.

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population standard deviation. */
export function std(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
  return Math.sqrt(v);
}

/** Coefficient of variation = std / |mean|. Returns Infinity when mean is 0. */
export function cv(xs: readonly number[]): number {
  const m = mean(xs);
  if (m === 0) return Infinity;
  return std(xs) / Math.abs(m);
}

export function median(xs: readonly number[]): number {
  return percentile(xs, 50);
}

/**
 * Linear-interpolated percentile (p in [0, 100]). Sorts a copy; never mutates input.
 */
export function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0;
  if (xs.length === 1) return xs[0];
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function sum(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
