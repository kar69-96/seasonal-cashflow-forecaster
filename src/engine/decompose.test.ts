import { describe, expect, it } from "vitest";
import { decompose } from "./decompose";
import { addDays } from "./dates";
import type { Transaction } from "@/domain/types";

function makeRecurring(start: string, periodDays: number, n: number): Transaction[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `loan-${i}`,
    date: addDays(start, i * periodDays),
    amount: -1200,
    vendor: "Farm Credit Services",
    category: "loan" as const,
  }));
}

describe("decompose (Phase A)", () => {
  it("classifies a steady monthly payment as a recurring stream", () => {
    const txns = makeRecurring("2024-01-01", 30, 12);
    const { recurring, seasonalTxns, oneOff } = decompose(txns, "2025-01-15");
    expect(recurring).toHaveLength(1);
    expect(recurring[0].category).toBe("loan");
    expect(recurring[0].amount).toBe(-1200);
    expect(recurring[0].periodDays).toBe(30);
    expect(recurring[0].confidence).toBeGreaterThan(0.9);
    expect(seasonalTxns).toHaveLength(0);
    expect(oneOff).toHaveLength(0);
  });

  it("nextDate is the first occurrence after the as-of date", () => {
    const txns = makeRecurring("2024-01-01", 30, 12);
    const { recurring } = decompose(txns, "2025-01-15");
    expect(recurring[0].nextDate > "2025-01-15").toBe(true);
  });

  it("routes irregular revenue to the seasonal model", () => {
    const txns: Transaction[] = [
      { id: "s1", date: "2023-10-10", amount: 90000, vendor: "Buyer", category: "egg_wholesale" },
      { id: "s2", date: "2024-10-12", amount: 110000, vendor: "Buyer", category: "egg_wholesale" },
      { id: "s3", date: "2025-10-08", amount: 95000, vendor: "Buyer", category: "egg_wholesale" },
    ];
    const { recurring, seasonalTxns } = decompose(txns, "2026-01-01");
    expect(recurring).toHaveLength(0);
    expect(seasonalTxns).toHaveLength(3);
  });

  it("treats a sparse non-seasonal flow as a one-off", () => {
    const txns: Transaction[] = [
      { id: "o1", date: "2024-03-01", amount: -3200, vendor: "Mutual Insurance", category: "insurance" },
    ];
    const { oneOff, recurring, seasonalTxns } = decompose(txns, "2025-01-01");
    expect(oneOff).toHaveLength(1);
    expect(recurring).toHaveLength(0);
    expect(seasonalTxns).toHaveLength(0);
  });
});
