"use client";
import { useMemo, useReducer } from "react";
import { generateLedger, defaultScenario, AS_OF } from "@/data/seed";
import { buildInputs } from "@/engine";
import { useSimulation } from "@/worker/useSimulation";
import { scenarioReducer } from "@/ui/scenarioReducer";
import { FanChart } from "@/ui/FanChart";
import { HeadlineMetrics } from "@/ui/HeadlineMetrics";
import { ScenarioPanel } from "@/ui/ScenarioPanel";
import { LedgerInsights } from "@/ui/LedgerInsights";
import { SourcesFooter } from "@/ui/SourcesFooter";

export default function Home() {
  // Ledger is deterministic; compute it (and the engine's decomposition) once.
  const ledger = useMemo(() => generateLedger(), []);
  const inputs = useMemo(() => buildInputs(ledger, AS_OF), [ledger]);

  const [scenario, dispatch] = useReducer(scenarioReducer, defaultScenario);
  const { result, isRunning } = useSimulation(scenario);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-700" />
          <span className="text-xs font-semibold uppercase tracking-widest text-green-800">
            Ambrook · Seasonal Cashflow Forecaster
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">
          Will this egg farm make it through the spring grow-out?
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {ledger.transactions.length.toLocaleString()} transactions across 5 years from a
          50,000-hen free-range operation, decomposed and simulated live.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {result ? (
            <>
              <HeadlineMetrics result={result} />
              <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-stone-700">
                    Projected cash balance
                  </h2>
                  <span
                    className={`text-xs ${
                      isRunning ? "text-amber-600" : "text-stone-400"
                    }`}
                  >
                    {isRunning ? "simulating…" : "5,000 paths"}
                  </span>
                </div>
                <FanChart result={result} buffer={scenario.buffer} />
              </div>
            </>
          ) : (
            <div className="flex h-[480px] items-center justify-center rounded-xl border border-stone-200 bg-white text-sm text-stone-400">
              Running first simulation…
            </div>
          )}

          <LedgerInsights inputs={inputs} outstanding={ledger.outstanding} />
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <ScenarioPanel
            scenario={scenario}
            dispatch={dispatch}
            onReset={() => dispatch({ type: "reset", scenario: defaultScenario })}
          />
        </aside>
      </div>

      <SourcesFooter />
    </main>
  );
}
