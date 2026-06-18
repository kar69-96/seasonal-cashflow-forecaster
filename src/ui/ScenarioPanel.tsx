"use client";
// Scenario controls. Each change dispatches an immutable update; the parent debounces
// and re-runs the worker, so the fan animates to its new shape.
import type { Dispatch } from "react";
import type { Scenario } from "@/domain/types";
import type { ScenarioAction } from "./scenarioReducer";
import { formatPct, formatUSD } from "./format";

interface Props {
  scenario: Scenario;
  dispatch: Dispatch<ScenarioAction>;
  onReset: () => void;
}

export function ScenarioPanel({ scenario, dispatch, onReset }: Props) {
  const lineEnabled = !!scenario.creditLine;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Scenario</h2>
        <button
          onClick={onReset}
          className="text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          Reset
        </button>
      </div>

      <div className="space-y-5">
        <Slider
          label="Egg price shock"
          value={scenario.priceShockPct}
          min={-0.3}
          max={0.2}
          step={0.01}
          display={formatPct(scenario.priceShockPct, 0)}
          accent={scenario.priceShockPct < 0 ? "text-red-600" : "text-green-700"}
          onChange={(v) => dispatch({ type: "priceShock", value: v })}
        />

        <Slider
          label="Input cost change"
          value={scenario.inputCostPct}
          min={-0.2}
          max={0.4}
          step={0.01}
          display={formatPct(scenario.inputCostPct, 0)}
          accent={scenario.inputCostPct > 0 ? "text-red-600" : "text-green-700"}
          onChange={(v) => dispatch({ type: "inputCost", value: v })}
        />

        <Slider
          label="Extra payment delay"
          value={scenario.extraPaymentDelayDays}
          min={0}
          max={60}
          step={1}
          display={`${scenario.extraPaymentDelayDays} days`}
          accent="text-stone-700"
          onChange={(v) => dispatch({ type: "paymentDelay", value: v })}
        />

        <div className="border-t border-stone-100 pt-4">
          <label className="flex cursor-pointer items-center justify-between">
            <span className="text-sm font-medium text-stone-700">Operating credit line</span>
            <input
              type="checkbox"
              checked={lineEnabled}
              onChange={(e) =>
                dispatch({ type: "toggleCreditLine", enabled: e.target.checked })
              }
              className="h-4 w-4 accent-green-700"
            />
          </label>

          {lineEnabled && scenario.creditLine && (
            <div className="mt-3">
              <Slider
                label="Credit limit"
                value={scenario.creditLine.limit}
                min={0}
                max={500000}
                step={10000}
                display={formatUSD(scenario.creditLine.limit, { compact: true })}
                accent="text-green-700"
                onChange={(v) => dispatch({ type: "creditLimit", value: v })}
              />
              <p className="mt-2 text-xs text-stone-400">
                Drawn automatically to defend the buffer at {scenario.creditLine.aprPct}% APR.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  accent: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, display, accent, onChange }: SliderProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-stone-600">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${accent}`}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-green-700"
      />
    </div>
  );
}
