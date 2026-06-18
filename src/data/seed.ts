/**
 * Synthetic ledger for a large pasture-raised / free-range egg-laying operation,
 * generated deterministically at high granularity (~5 years, thousands of transactions).
 *
 * The numbers are FAKE (no real customer data), but the magnitudes, cost mix, and
 * seasonality are parameterized from public benchmarks so the demo is grounded:
 *
 *  - Production, layer counts & egg price path ... USDA NASS "Chickens and Eggs".
 *    https://quickstats.nass.usda.gov
 *  - Wholesale egg prices & volatility ........... USDA AMS Egg Markets Overview.
 *    https://www.ams.usda.gov/market-news/egg-market-news-reports
 *  - Feed cost (~65% of total cost) .............. USDA ERS Feed Grains data.
 *    https://www.ers.usda.gov/data-products/feed-grains-database
 *  - Layer enterprise cost structure & calendar .. university extension poultry budgets
 *    (e.g. Iowa State Ag Decision Maker). https://www.extension.iastate.edu/agdm
 *
 * The story: each late winter the farm places a new flock of pullets (a big lump cost)
 * and culls the old flock. The new birds don't lay sellable eggs for ~4-5 months, so
 * spring is a cash valley — heavy feed with depressed egg revenue — before production and
 * holiday-season egg prices lift cash into the fall. Everything is illustrative sample
 * data, deterministically seeded so every demo run is identical.
 */
import type {
  Category,
  ISODate,
  OutstandingItem,
  Scenario,
  Transaction,
} from "@/domain/types";
import type { LedgerData } from "@/engine";
import type { PaidReceivable } from "@/engine/paymentTiming";
import { mulberry32, type Rng } from "@/engine/rng";
import { addDays, daysBetween, monthOf, parseISO, toISO } from "@/engine/dates";

/** Master seed — every demo run is byte-for-byte identical. */
export const SEED = 20260301;

/** Scale dials — "really big" lives here. */
export const FLOCK_SIZE = 50_000; // free-range laying hens
const HISTORY_MONTHS = 60; // 5 years of books
const SCALE = FLOCK_SIZE / 50_000;
export const AS_OF: ISODate = "2026-03-01"; // early spring, just after the flock turnover

// ----- Seasonal index tables (Jan..Dec) ------------------------------------------------
const FLAT = Array(12).fill(1);
// Egg revenue = production x price. Spring changeover trough (new flock not laying yet),
// fall peak (full production x holiday-baking prices). Drives the cash valley.
const EGG = [0.95, 0.78, 0.55, 0.5, 0.55, 0.72, 0.95, 1.1, 1.2, 1.32, 1.45, 1.4];
const FEED = [1.0, 1.05, 1.1, 1.1, 1.05, 1.0, 0.98, 1.0, 1.0, 1.0, 1.02, 1.03];
const UTIL = [1.2, 1.2, 1.05, 0.95, 0.95, 1.1, 1.2, 1.2, 1.0, 0.95, 1.05, 1.2];
const GAS = [1.5, 1.5, 1.2, 0.8, 0.5, 0.3, 0.3, 0.3, 0.5, 0.8, 1.2, 1.5];
const LABOR = [0.9, 1.1, 1.2, 1.0, 0.9, 0.9, 1.0, 1.1, 1.2, 1.3, 1.3, 1.1];
const PACK = [1.0, 0.9, 0.75, 0.7, 0.75, 0.85, 1.0, 1.1, 1.15, 1.2, 1.25, 1.2];
const HEALTH = [0.6, 1.0, 1.4, 1.3, 0.9, 0.6, 0.6, 0.8, 1.2, 1.1, 0.7, 0.6];

// ----- Emitter model -------------------------------------------------------------------
interface Ctx {
  i: number; // day index from history start
  dom: number; // day of month, 1..31
  dw: number; // day of week, 0=Sun..6=Sat
  month: number; // 1..12
}

interface Emitter {
  category: Category;
  vendor: string;
  sign: 1 | -1;
  base: number; // per-occurrence magnitude at FLOCK_SIZE = 50k
  noise: number; // std as a fraction of base (0 = exact, for fixed obligations)
  seasonal: number[]; // 12-month multipliers (FLAT for none)
  enterprise: string;
  fires: (c: Ctx) => boolean;
}

const dows =
  (...d: number[]) =>
  (c: Ctx) =>
    d.includes(c.dw);
const onDom =
  (dom: number) =>
  (c: Ctx) =>
    c.dom === dom;
const biweekly =
  (offset: number) =>
  (c: Ctx) =>
    c.i % 14 === offset;

const EMITTERS: Emitter[] = [
  // --- Variable costs (routed to the seasonal model) ---
  { category: "feed", vendor: "Kreamer Feed Mill", sign: -1, base: 8800, noise: 0.12, seasonal: FEED, enterprise: "layers", fires: dows(1) },
  { category: "feed", vendor: "Nature's Best Feeds", sign: -1, base: 8800, noise: 0.13, seasonal: FEED, enterprise: "layers", fires: dows(4) },
  { category: "utilities", vendor: "Rural Electric Co-op", sign: -1, base: 7000, noise: 0.1, seasonal: UTIL, enterprise: "layers", fires: onDom(15) },
  { category: "utilities", vendor: "Suburban Propane", sign: -1, base: 2500, noise: 0.15, seasonal: GAS, enterprise: "layers", fires: onDom(20) },
  { category: "utilities", vendor: "Township Water", sign: -1, base: 1200, noise: 0.08, seasonal: FLAT, enterprise: "layers", fires: onDom(25) },
  { category: "labor", vendor: "Grading Crew", sign: -1, base: 1500, noise: 0.1, seasonal: LABOR, enterprise: "layers", fires: dows(1, 3, 5) },
  { category: "packaging", vendor: "Egg Carton Supply Co", sign: -1, base: 2100, noise: 0.12, seasonal: PACK, enterprise: "layers", fires: dows(1, 4) },
  { category: "flock_health", vendor: "Poultry Vet Services", sign: -1, base: 2600, noise: 0.25, seasonal: HEALTH, enterprise: "layers", fires: onDom(8) },
  { category: "bedding", vendor: "Lancaster Shavings", sign: -1, base: 1000, noise: 0.2, seasonal: FLAT, enterprise: "layers", fires: biweekly(3) },
  { category: "supplies", vendor: "Tractor Supply", sign: -1, base: 400, noise: 0.35, seasonal: FLAT, enterprise: "layers", fires: dows(3, 6) },
  { category: "repairs", vendor: "A&M Repair", sign: -1, base: 700, noise: 0.4, seasonal: FLAT, enterprise: "layers", fires: biweekly(12) },
  // Pullet replacement flock — big Feb lumps that open the spring valley.
  { category: "pullets", vendor: "Pullet Source Co", sign: -1, base: 60000, noise: 0.08, seasonal: FLAT, enterprise: "layers", fires: (c) => c.month === 2 && [5, 12, 19].includes(c.dom) },

  // --- Revenue (routed to the seasonal model) ---
  { category: "egg_wholesale", vendor: "Eastern Grocers Dist.", sign: 1, base: 2600, noise: 0.12, seasonal: EGG, enterprise: "layers", fires: dows(1, 2, 3, 4, 5, 6) },
  { category: "egg_wholesale", vendor: "Valley Foods Co-op", sign: 1, base: 2350, noise: 0.14, seasonal: EGG, enterprise: "layers", fires: dows(1, 2, 3, 4, 5) },
  { category: "egg_wholesale", vendor: "Keystone Markets", sign: 1, base: 2950, noise: 0.16, seasonal: EGG, enterprise: "layers", fires: dows(2, 4, 6) },
  { category: "egg_restaurant", vendor: "Hearthstone Bakery", sign: 1, base: 1550, noise: 0.15, seasonal: EGG, enterprise: "layers", fires: dows(2, 5) },
  { category: "egg_restaurant", vendor: "Riverside Cafe Group", sign: 1, base: 1550, noise: 0.18, seasonal: EGG, enterprise: "layers", fires: dows(1, 4) },
  { category: "egg_restaurant", vendor: "Campus Dining Svc", sign: 1, base: 1550, noise: 0.2, seasonal: EGG, enterprise: "layers", fires: dows(3, 6) },
  { category: "egg_retail", vendor: "Downtown Farmers Market", sign: 1, base: 3200, noise: 0.2, seasonal: EGG, enterprise: "layers", fires: dows(6) },
  { category: "egg_retail", vendor: "Midweek Market", sign: 1, base: 2300, noise: 0.22, seasonal: EGG, enterprise: "layers", fires: (c) => c.dw === 3 && c.month >= 4 && c.month <= 11 },
  // Spent-hen sales when the old flock is culled at turnover.
  { category: "spent_hen_sales", vendor: "Spent Hen Buyer", sign: 1, base: 12500, noise: 0.15, seasonal: FLAT, enterprise: "layers", fires: (c) => c.month === 2 && [10, 17].includes(c.dom) },
  { category: "compost_sales", vendor: "Garden Centers LLC", sign: 1, base: 1500, noise: 0.2, seasonal: FLAT, enterprise: "compost", fires: biweekly(8) },

  // --- Fixed obligations (clean recurrence -> Phase A) ---
  { category: "loan", vendor: "Farm Credit Services", sign: -1, base: 8000, noise: 0, seasonal: FLAT, enterprise: "layers", fires: onDom(1) },
  { category: "lease", vendor: "Barn & Land Lease LLC", sign: -1, base: 6000, noise: 0, seasonal: FLAT, enterprise: "layers", fires: onDom(1) },
  { category: "insurance", vendor: "Mutual of Omaha", sign: -1, base: 2200, noise: 0, seasonal: FLAT, enterprise: "layers", fires: onDom(3) },
  { category: "payroll", vendor: "Payroll", sign: -1, base: 14000, noise: 0.03, seasonal: FLAT, enterprise: "layers", fires: biweekly(5) },
];

function noisy(rng: Rng, base: number, noiseFrac: number): number {
  const factor = 1 + (rng.next() * 2 - 1) * noiseFrac;
  return Math.round(base * factor);
}

function monthsBefore(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso);
  d.setUTCMonth(d.getUTCMonth() - n);
  return toISO(d);
}

/** Generate the full ledger: ~5 years of high-granularity history + outstanding items. */
export function generateLedger(): LedgerData {
  const rng = mulberry32(SEED);
  const transactions: Transaction[] = [];
  let id = 0;

  const start = monthsBefore(AS_OF, HISTORY_MONTHS);
  const totalDays = daysBetween(start, AS_OF);

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(start, i);
    const d = parseISO(date);
    const ctx: Ctx = { i, dom: d.getUTCDate(), dw: d.getUTCDay(), month: monthOf(date) };

    for (const e of EMITTERS) {
      if (!e.fires(ctx)) continue;
      const mult = e.seasonal[ctx.month - 1];
      const amt = noisy(rng, e.base * SCALE * mult, e.noise);
      if (amt <= 0) continue;
      transactions.push({
        id: `${e.category}-${id++}`,
        date,
        amount: e.sign * amt,
        vendor: e.vendor,
        category: e.category,
        enterprise: e.enterprise,
      });
    }
  }

  return { transactions, outstanding: outstanding(), paidHistory: paymentHistory() };
}

/**
 * Known outstanding items as of AS_OF. The receivables fall due across the spring grow-out,
 * so a payment delay pushes them past the cash valley and deepens the shortfall. The
 * payables (final pullet + bulk-feed bills) bite right at the start.
 */
function outstanding(): OutstandingItem[] {
  const ar = (id: string, days: number, amount: number): OutstandingItem => ({
    id,
    dueDate: addDays(AS_OF, days),
    amount: Math.round(amount * SCALE),
    kind: "receivable",
  });
  const ap = (id: string, days: number, amount: number): OutstandingItem => ({
    id,
    dueDate: addDays(AS_OF, days),
    amount: -Math.round(amount * SCALE),
    kind: "payable",
  });
  return [
    ar("ar-grocers", 35, 45000), // Eastern Grocers — net-30 on Feb shipments
    ar("ar-coop", 58, 32000), // Valley Foods Co-op
    ar("ar-bakery", 44, 14000), // Hearthstone Bakery account
    ar("ar-keystone", 75, 28000), // Keystone Markets
    ap("ap-pullets", 9, 48000), // final payment on the replacement flock
    ap("ap-feed", 14, 36000), // bulk feed contract
  ];
}

/** Historical paid wholesale invoices — net-30 settled 4-28 days late (feeds Phase C). */
function paymentHistory(): PaidReceivable[] {
  const rng = mulberry32(SEED ^ 0x5151);
  const history: PaidReceivable[] = [];
  for (let i = 0; i < 36; i++) {
    const due = addDays("2024-01-15", i * 18);
    const daysLate = Math.floor(4 + rng.next() * 24);
    history.push({ dueDate: due, paidDate: addDays(due, daysLate) });
  }
  return history;
}

/** Default scenario: 240-day horizon (Mar 1 -> ~Oct 27) spans the grow-out valley + recovery. */
export const defaultScenario: Scenario = {
  priceShockPct: 0,
  inputCostPct: 0,
  extraPaymentDelayDays: 0,
  creditLine: undefined,
  horizonDays: 240,
  paths: 5000,
  buffer: 25000,
  startBalance: 380000,
  asOf: AS_OF,
};
