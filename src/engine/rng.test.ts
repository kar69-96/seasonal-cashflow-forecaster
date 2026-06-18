import { describe, expect, it } from "vitest";
import { mulberry32, samplePositive } from "./rng";
import { mean, std } from "./stats";

describe("rng", () => {
  it("is reproducible: same seed => identical sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("uniform draws stay in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("normal() is roughly standard normal", () => {
    const r = mulberry32(123);
    const xs = Array.from({ length: 5000 }, () => r.normal());
    expect(mean(xs)).toBeCloseTo(0, 1);
    expect(std(xs)).toBeCloseTo(1, 1);
  });

  it("samplePositive matches target mean within tolerance and stays non-negative", () => {
    const r = mulberry32(99);
    const xs = Array.from({ length: 8000 }, () => samplePositive(r, 100, 30));
    expect(Math.min(...xs)).toBeGreaterThan(0);
    expect(mean(xs)).toBeGreaterThan(85);
    expect(mean(xs)).toBeLessThan(115);
  });
});
