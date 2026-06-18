import { describe, expect, it } from "vitest";
import { simulate, type SimInputs } from "./simulate";
import { computeMetrics } from "./metrics";
import type { Scenario } from "@/domain/types";

const baseScenario: Scenario = {
  priceShockPct: 0,
  inputCostPct: 0,
  extraPaymentDelayDays: 0,
  horizonDays: 30,
  paths: 500,
  buffer: 0,
  startBalance: 10000,
  asOf: "2026-06-15",
};

const recurringInputs: SimInputs = {
  recurring: [
    {
      vendor: "Farm Credit",
      category: "loan",
      amount: -1000,
      periodDays: 30,
      nextDate: "2026-06-25",
      confidence: 0.95,
    },
  ],
  seasonal: [],
  outstanding: [],
  timing: { daysLateSamples: [0], meanDaysLate: 0 },
};

describe("simulate (Phase D)", () => {
  it("is deterministic: same seed + scenario => identical paths", () => {
    const a = simulate(recurringInputs, baseScenario, 2026);
    const b = simulate(recurringInputs, baseScenario, 2026);
    expect(a).toEqual(b);
  });

  it("applies deterministic recurring flows on schedule", () => {
    const paths = simulate(recurringInputs, baseScenario, 1);
    // Loan hits on 2026-06-25 (day 10): balance drops by 1000 and stays there.
    for (const path of paths) {
      expect(path[0]).toBe(10000);
      expect(path[30]).toBe(9000);
    }
  });

  it("a credit line lifts the floor", () => {
    const inputs: SimInputs = {
      ...recurringInputs,
      recurring: [
        {
          vendor: "Big Bill",
          category: "loan",
          amount: -15000,
          periodDays: 30,
          nextDate: "2026-06-20",
          confidence: 0.9,
        },
      ],
    };
    const noLine = computeMetrics(simulate(inputs, baseScenario, 5), baseScenario);
    const withLine = computeMetrics(
      simulate(inputs, { ...baseScenario, creditLine: { limit: 20000, aprPct: 8 } }, 5),
      { ...baseScenario, creditLine: { limit: 20000, aprPct: 8 } },
    );
    expect(noLine.pShortfall).toBeGreaterThan(0);
    expect(withLine.pShortfall).toBeLessThan(noLine.pShortfall);
  });

  it("a negative price shock raises shortfall probability", () => {
    const inputs: SimInputs = {
      recurring: [],
      seasonal: [
        {
          category: "egg_wholesale",
          sign: 1,
          dominantPeriodDays: 30,
          monthlyProfile: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            pOccur: 1,
            mean: 2000,
            std: 200,
          })),
        },
      ],
      outstanding: [],
      timing: { daysLateSamples: [0], meanDaysLate: 0 },
    };
    const scenario: Scenario = { ...baseScenario, buffer: 12000, startBalance: 10000 };
    const base = computeMetrics(simulate(inputs, scenario, 3), scenario);
    const shocked = computeMetrics(
      simulate(inputs, { ...scenario, priceShockPct: -0.5 }, 3),
      { ...scenario, priceShockPct: -0.5 },
    );
    expect(shocked.pShortfall).toBeGreaterThanOrEqual(base.pShortfall);
  });
});

describe("metrics (Phase E)", () => {
  it("produces monotonic bands p5 <= p25 <= p50 <= p75 <= p95", () => {
    const inputs: SimInputs = {
      recurring: [],
      seasonal: [
        {
          category: "feed",
          sign: -1,
          dominantPeriodDays: 30,
          monthlyProfile: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            pOccur: 0.8,
            mean: 1500,
            std: 600,
          })),
        },
      ],
      outstanding: [],
      timing: { daysLateSamples: [0], meanDaysLate: 0 },
    };
    const result = computeMetrics(simulate(inputs, baseScenario, 11), baseScenario);
    for (let d = 0; d < result.days.length; d++) {
      expect(result.bands.p5[d]).toBeLessThanOrEqual(result.bands.p25[d]);
      expect(result.bands.p25[d]).toBeLessThanOrEqual(result.bands.p50[d]);
      expect(result.bands.p50[d]).toBeLessThanOrEqual(result.bands.p75[d]);
      expect(result.bands.p75[d]).toBeLessThanOrEqual(result.bands.p95[d]);
    }
    expect(result.pShortfall).toBeGreaterThanOrEqual(0);
    expect(result.pShortfall).toBeLessThanOrEqual(1);
  });
});
