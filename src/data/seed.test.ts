import { describe, expect, it } from "vitest";
import { generateLedger, defaultScenario, SEED } from "./seed";
import { buildInputs, runForecast } from "@/engine";
import { backtest } from "@/engine/backtest";

describe("seed ledger + full pipeline (integration)", () => {
  const data = generateLedger();

  it("generates a really big multi-year ledger", () => {
    expect(data.transactions.length).toBeGreaterThan(6000);
  });

  it("Phase A finds the fixed obligations and routes revenue to seasonal", () => {
    const inputs = buildInputs(data, defaultScenario.asOf);
    const cats = inputs.recurring.map((r) => r.category).sort();
    expect(cats).toEqual(["insurance", "lease", "loan", "payroll"]);
    const seasonalCats = inputs.seasonal.map((s) => s.category);
    expect(seasonalCats).toContain("egg_wholesale");
    expect(seasonalCats).toContain("feed");
    expect(seasonalCats).toContain("pullets");
  });

  it("the seasonal profile learns the fall egg-revenue peak vs spring trough", () => {
    const inputs = buildInputs(data, defaultScenario.asOf);
    const eggs = inputs.seasonal.find((s) => s.category === "egg_wholesale")!;
    const nov = eggs.monthlyProfile[10]; // month 11 (holiday peak)
    const apr = eggs.monthlyProfile[3]; // month 4 (grow-out trough)
    expect(nov.mean).toBeGreaterThan(apr.mean * 1.5);
    // Pullets are a February-only cost spike.
    const pullets = inputs.seasonal.find((s) => s.category === "pullets")!;
    expect(pullets.monthlyProfile[1].mean).toBeGreaterThan(0); // Feb
    expect(pullets.monthlyProfile[6].mean).toBe(0); // Jul
  });

  it("produces a plausible forecast with a real-but-not-certain shortfall risk", () => {
    const result = runForecast(data, defaultScenario, SEED);
    expect(result.pShortfall).toBeGreaterThan(0.15);
    expect(result.pShortfall).toBeLessThan(0.6);
    expect(result.recommendedLine).toBeGreaterThan(0);
    // The trough should land in the spring/early-summer grow-out window.
    expect(result.troughDate >= "2026-03-15").toBe(true);
    expect(result.troughDate <= "2026-08-01").toBe(true);
  });

  it("walk-forward calibration produces a monotonic coverage curve", () => {
    const result = backtest(data, defaultScenario, SEED, 60);
    expect(result.points).toHaveLength(9);
    for (let i = 1; i < result.points.length; i++) {
      // Wider nominal intervals never cover less than narrower ones.
      expect(result.points[i].empirical).toBeGreaterThanOrEqual(
        result.points[i - 1].empirical - 0.05,
      );
    }
    for (const p of result.points) {
      expect(p.empirical).toBeGreaterThanOrEqual(0);
      expect(p.empirical).toBeLessThanOrEqual(1);
    }
  });
});
