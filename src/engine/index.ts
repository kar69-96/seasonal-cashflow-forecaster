// Orchestration: data in -> decompose -> seasonality -> timing -> simulate -> metrics.
import type {
  OutstandingItem,
  Scenario,
  SimResult,
  Transaction,
} from "@/domain/types";
import { decompose } from "./decompose";
import { buildSeasonalStreams } from "./seasonality";
import { fitPaymentTiming, type PaidReceivable } from "./paymentTiming";
import { simulate, type SimInputs } from "./simulate";
import { computeMetrics } from "./metrics";

/** Everything the engine needs from a farm's books. */
export interface LedgerData {
  transactions: Transaction[];
  outstanding: OutstandingItem[];
  paidHistory: PaidReceivable[]; // settled receivables, for payment-timing
}

/** Build the simulation inputs from raw ledger data (Phases A–C). */
export function buildInputs(data: LedgerData, asOf: string): SimInputs {
  const { recurring, seasonalTxns } = decompose(data.transactions, asOf);
  const seasonal = buildSeasonalStreams(seasonalTxns);
  const timing = fitPaymentTiming(data.paidHistory);

  return { recurring, seasonal, outstanding: data.outstanding, timing };
}

/** Run the full forecast pipeline and return decision metrics. */
export function runForecast(
  data: LedgerData,
  scenario: Scenario,
  seed: number,
): SimResult {
  const inputs = buildInputs(data, scenario.asOf);
  const paths = simulate(inputs, scenario, seed);
  return computeMetrics(paths, scenario);
}

export { decompose, buildSeasonalStreams, fitPaymentTiming, simulate, computeMetrics };
export type { SimInputs };
