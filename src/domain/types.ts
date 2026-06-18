// Domain model for the Seasonal Cashflow Forecaster.
// Grounded in Ambrook's real ledger tagging: enterprise / category / Schedule F line.

export type ISODate = string; // 'YYYY-MM-DD'

/** A single posted ledger entry. Amount is signed: + inflow, - outflow. */
export interface Transaction {
  id: string;
  date: ISODate;
  amount: number;
  vendor: string; // 'Kreamer Feed', 'Pullet Source Co', grocery distributor, ...
  category: Category;
  enterprise?: string; // 'layers', 'pasture', 'compost'
  scheduleF?: string; // optional Schedule F line mapping
}

export type Category =
  // Fixed obligations (detected as clean recurrence by Phase A)
  | "loan"
  | "lease"
  | "insurance"
  | "payroll"
  // Variable costs (seasonal model; hit by the input-cost slider)
  | "feed"
  | "pullets"
  | "utilities"
  | "labor"
  | "packaging"
  | "flock_health"
  | "bedding"
  | "supplies"
  | "repairs"
  // Revenue (seasonal model; hit by the egg-price slider)
  | "egg_wholesale"
  | "egg_retail"
  | "egg_restaurant"
  | "spent_hen_sales"
  | "compost_sales";

/** Known future cash event: an unpaid receivable (AR) or payable (AP). */
export interface OutstandingItem {
  id: string;
  dueDate: ISODate;
  amount: number; // + for receivable, - for payable
  kind: "receivable" | "payable";
}

/** Output of Phase A for clean, deterministic flows (loans, leases, payroll). */
export interface RecurringStream {
  vendor: string;
  category: Category;
  amount: number; // median signed amount per occurrence
  periodDays: number; // median gap between occurrences
  nextDate: ISODate; // next expected occurrence after the as-of date
  confidence: number; // 0..1 from gap/amount stability
}

/** Output of Phase A + B for variable / seasonal flows. */
export interface SeasonalStream {
  category: Category;
  sign: 1 | -1; // revenue (+) or cost (-)
  monthlyProfile: MonthStat[]; // 12 entries, month 1..12
  dominantPeriodDays: number; // from autocorrelation (≈365 annual, ≈30 monthly)
}

export interface MonthStat {
  month: number; // 1..12
  pOccur: number; // probability a flow occurs in this month
  mean: number; // mean magnitude (>= 0) when it occurs
  std: number; // std of magnitude
}

/** Empirical days-late distribution for receivable settlement (Phase C). */
export interface PaymentTiming {
  daysLateSamples: number[]; // empirical samples; sampled at sim time
  meanDaysLate: number;
}

export interface CreditLine {
  limit: number;
  aprPct: number; // annual %, accrued daily on drawn balance
}

/** User-controlled scenario knobs driving a simulation run. */
export interface Scenario {
  priceShockPct: number; // applied to revenue categories, e.g. -0.1
  inputCostPct: number; // applied to variable cost categories, e.g. +0.15
  extraPaymentDelayDays: number; // shift AR settlement later
  creditLine?: CreditLine;
  horizonDays: number; // default 90
  paths: number; // default 5000
  buffer: number; // minimum operating cash, e.g. 5000
  startBalance: number; // cash on hand at as-of date
  asOf: ISODate; // simulation start date
}

export type BandKey = "p5" | "p25" | "p50" | "p75" | "p95";

export interface SimResult {
  days: ISODate[];
  bands: Record<BandKey, number[]>;
  pShortfall: number; // fraction of paths whose min balance < buffer
  troughDate: ISODate; // day of peak shortfall frequency
  troughIndex: number;
  recommendedLine: number; // 95th-pct max drawdown below buffer
  endingBalances: number[]; // day-horizon balances, for a histogram
}

export interface CalibrationPoint {
  nominal: number; // claimed coverage, 0..1
  empirical: number; // observed coverage on held-out data, 0..1
}

export interface BacktestResult {
  points: CalibrationPoint[];
  holdoutDays: number;
  verdict: string;
}
