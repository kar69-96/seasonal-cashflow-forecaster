/// <reference lib="webworker" />
// Runs the heavy simulation off the main thread so slider drags stay smooth.
import type { Scenario, SimResult } from "@/domain/types";
import { runForecast } from "@/engine";
import { generateLedger, SEED } from "@/data/seed";

export type WorkerRequest = { type: "forecast"; id: number; scenario: Scenario };
export type WorkerResponse = { type: "forecast"; id: number; result: SimResult };

// The ledger is deterministic from SEED, so regenerate it once in worker scope
// rather than serializing ~150 transactions across the thread boundary repeatedly.
const ledger = generateLedger();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "forecast") {
    const result = runForecast(ledger, msg.scenario, SEED);
    const response: WorkerResponse = { type: "forecast", id: msg.id, result };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  }
};
