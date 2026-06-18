import type { Category } from "@/domain/types";

/** Revenue categories — positive cash, subject to the egg-price-shock scenario knob. */
export const REVENUE_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  "egg_wholesale",
  "egg_retail",
  "egg_restaurant",
  "spent_hen_sales",
  "compost_sales",
]);

/** Variable cost categories — negative cash, subject to the input-cost scenario knob. */
export const VARIABLE_COST_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  "feed",
  "pullets",
  "utilities",
  "labor",
  "packaging",
  "flock_health",
  "bedding",
  "supplies",
  "repairs",
]);

/** Categories routed to the seasonal/stochastic model rather than deterministic recurrence. */
export const SEASONAL_CANDIDATES: ReadonlySet<Category> = new Set<Category>([
  ...REVENUE_CATEGORIES,
  ...VARIABLE_COST_CATEGORIES,
]);

export function isRevenue(category: Category): boolean {
  return REVENUE_CATEGORIES.has(category);
}

export function isVariableCost(category: Category): boolean {
  return VARIABLE_COST_CATEGORIES.has(category);
}
