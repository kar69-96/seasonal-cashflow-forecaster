// Small reducer for the user-controlled Scenario. Immutable updates only.
import type { Scenario } from "@/domain/types";

export type ScenarioAction =
  | { type: "priceShock"; value: number }
  | { type: "inputCost"; value: number }
  | { type: "paymentDelay"; value: number }
  | { type: "toggleCreditLine"; enabled: boolean }
  | { type: "creditLimit"; value: number }
  | { type: "reset"; scenario: Scenario };

const DEFAULT_LINE = { limit: 200000, aprPct: 8.5 };

export function scenarioReducer(state: Scenario, action: ScenarioAction): Scenario {
  switch (action.type) {
    case "priceShock":
      return { ...state, priceShockPct: action.value };
    case "inputCost":
      return { ...state, inputCostPct: action.value };
    case "paymentDelay":
      return { ...state, extraPaymentDelayDays: action.value };
    case "toggleCreditLine":
      return {
        ...state,
        creditLine: action.enabled
          ? (state.creditLine ?? DEFAULT_LINE)
          : undefined,
      };
    case "creditLimit":
      return {
        ...state,
        creditLine: { ...(state.creditLine ?? DEFAULT_LINE), limit: action.value },
      };
    case "reset":
      return action.scenario;
    default:
      return state;
  }
}
