import { describe, expect, it } from "vitest";
import { cv, mean, median, percentile, std, sum } from "./stats";

describe("stats", () => {
  it("mean and sum", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(sum([1, 2, 3, 4])).toBe(10);
    expect(mean([])).toBe(0);
  });

  it("population std", () => {
    expect(std([2, 2, 2])).toBe(0);
    expect(std([1, 3])).toBeCloseTo(1, 10);
  });

  it("cv = std / |mean|", () => {
    expect(cv([2, 2, 2])).toBe(0);
    expect(cv([0, 0])).toBe(Infinity);
    expect(cv([1, 3])).toBeCloseTo(0.5, 10);
  });

  it("percentile interpolates and never mutates input", () => {
    const xs = [10, 20, 30, 40];
    expect(percentile(xs, 0)).toBe(10);
    expect(percentile(xs, 100)).toBe(40);
    expect(percentile(xs, 50)).toBe(25);
    expect(median(xs)).toBe(25);
    expect(xs).toEqual([10, 20, 30, 40]); // unchanged
  });

  it("bands are monotonic across percentiles", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i);
    const p5 = percentile(xs, 5);
    const p50 = percentile(xs, 50);
    const p95 = percentile(xs, 95);
    expect(p5).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(p95);
  });
});
