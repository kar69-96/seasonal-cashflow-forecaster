// Seedable PRNG so every demo run is byte-for-byte reproducible.
// mulberry32: tiny, fast, good enough statistical quality for Monte Carlo.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Standard normal via Box–Muller. */
  normal(): number;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const normal = (): number => {
    // Box–Muller; guard against log(0).
    let u = next();
    while (u === 0) u = next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  return { next, normal };
}

/** Sample a lognormal value with the given mean and std of the *underlying* normal. */
export function sampleLognormal(rng: Rng, mean: number, std: number): number {
  return Math.exp(mean + std * rng.normal());
}

/**
 * Sample a positive magnitude with a target arithmetic mean and std, using a
 * lognormal shape (cashflow magnitudes are right-skewed and non-negative).
 */
export function samplePositive(rng: Rng, mean: number, std: number): number {
  if (mean <= 0) return 0;
  if (std <= 0) return mean;
  // Convert arithmetic (mean, std) to lognormal params (mu, sigma).
  const variance = std * std;
  const sigma2 = Math.log(1 + variance / (mean * mean));
  const mu = Math.log(mean) - sigma2 / 2;
  return sampleLognormal(rng, mu, Math.sqrt(sigma2));
}

/** Pick a uniformly random element from a non-empty array. */
export function sampleFrom<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng.next() * arr.length)];
}
