// Phase A — classify each flow as deterministic-recurring, seasonal/stochastic, or one-off.
import type { Category, RecurringStream, Transaction } from "@/domain/types";
import { SEASONAL_CANDIDATES } from "./categories";
import { addDays, daysBetween } from "./dates";
import { cv, median } from "./stats";

/** Thresholds for calling a flow "clean recurring" (loans, leases, payroll, insurance). */
export const GAP_CV_THRESHOLD = 0.15;
export const AMOUNT_CV_THRESHOLD = 0.2;
const MIN_OCCURRENCES = 3;

export interface Decomposition {
  recurring: RecurringStream[];
  /** Transactions routed to Phase B (seasonal model), grouped by category+sign. */
  seasonalTxns: Transaction[];
  /** Everything else: sparse / irregular flows treated as one-offs. */
  oneOff: Transaction[];
}

interface Group {
  vendor: string;
  category: Category;
  sign: number;
  txns: Transaction[];
}

function groupKey(t: Transaction): string {
  return `${t.vendor}|${t.category}|${Math.sign(t.amount)}`;
}

function groupTransactions(txns: readonly Transaction[]): Group[] {
  const map = new Map<string, Group>();
  for (const t of txns) {
    const key = groupKey(t);
    const existing = map.get(key);
    if (existing) {
      existing.txns = [...existing.txns, t];
    } else {
      map.set(key, {
        vendor: t.vendor,
        category: t.category,
        sign: Math.sign(t.amount),
        txns: [t],
      });
    }
  }
  return [...map.values()];
}

function consecutiveGaps(sortedDates: string[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    gaps.push(daysBetween(sortedDates[i - 1], sortedDates[i]));
  }
  return gaps;
}

/**
 * Decompose a transaction history as of `asOf`.
 * Pure: returns new arrays, never mutates the input.
 */
export function decompose(txns: readonly Transaction[], asOf: string): Decomposition {
  const recurring: RecurringStream[] = [];
  const seasonalTxns: Transaction[] = [];
  const oneOff: Transaction[] = [];

  for (const group of groupTransactions(txns)) {
    const sorted = [...group.txns].sort((a, b) => (a.date < b.date ? -1 : 1));
    const amounts = sorted.map((t) => t.amount);

    // Revenue and variable costs are inherently uncertain (price/seasonality):
    // always model them stochastically via Phase B, even if past amounts look stable.
    if (SEASONAL_CANDIDATES.has(group.category)) {
      seasonalTxns.push(...sorted);
      continue;
    }

    // Fixed obligations (loan, lease, insurance, ...): detect clean recurrence.
    if (sorted.length >= MIN_OCCURRENCES) {
      const gaps = consecutiveGaps(sorted.map((t) => t.date));
      const gapCv = cv(gaps);
      const amountCv = cv(amounts);

      if (gapCv < GAP_CV_THRESHOLD && amountCv < AMOUNT_CV_THRESHOLD) {
        const periodDays = Math.round(median(gaps));
        const lastDate = sorted[sorted.length - 1].date;
        recurring.push({
          vendor: group.vendor,
          category: group.category,
          amount: median(amounts),
          periodDays,
          nextDate: nextOccurrence(lastDate, periodDays, asOf),
          confidence: 1 - Math.max(gapCv, amountCv),
        });
        continue;
      }
    }

    oneOff.push(...sorted);
  }

  return { recurring, seasonalTxns, oneOff };
}

/** Advance from the last seen date by whole periods until strictly after `asOf`. */
function nextOccurrence(lastDate: string, periodDays: number, asOf: string): string {
  let next = lastDate;
  const safetyMax = 1000;
  for (let i = 0; i < safetyMax && daysBetween(asOf, next) <= 0; i++) {
    next = addDays(next, periodDays);
  }
  return next;
}
