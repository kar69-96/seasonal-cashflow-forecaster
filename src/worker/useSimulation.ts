"use client";
// React hook owning the simulation worker lifecycle. Debounces scenario changes
// so dragging a slider re-runs the Monte Carlo without janking the UI.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Scenario, SimResult } from "@/domain/types";
import type { WorkerRequest, WorkerResponse } from "./sim.worker";

const DEBOUNCE_MS = 140;

interface SimulationState {
  result: SimResult | null;
  isRunning: boolean;
}

export function useSimulation(scenario: Scenario): SimulationState {
  const [state, setState] = useState<SimulationState>({
    result: null,
    isRunning: true,
  });
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const latestId = useRef(0);

  // Spawn the worker once.
  useEffect(() => {
    const worker = new Worker(new URL("./sim.worker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      // Ignore stale responses from superseded scenario changes.
      if (msg.id !== latestId.current) return;
      setState({ result: msg.result, isRunning: false });
    };

    return () => worker.terminate();
  }, []);

  const runForecast = useCallback((s: Scenario) => {
    const worker = workerRef.current;
    if (!worker) return;
    const id = ++requestId.current;
    latestId.current = id;
    setState((prev) => ({ ...prev, isRunning: true }));
    const req: WorkerRequest = { type: "forecast", id, scenario: s };
    worker.postMessage(req);
  }, []);

  // Debounced re-run whenever the scenario changes.
  useEffect(() => {
    const handle = setTimeout(() => runForecast(scenario), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [scenario, runForecast]);

  return state;
}
