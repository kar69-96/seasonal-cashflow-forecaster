// Phase C — model how late receivables actually settle.
// On a short horizon, payment timing risk often dominates seasonal price risk.
import type { ISODate, PaymentTiming } from "@/domain/types";
import type { Rng } from "./rng";
import { sampleFrom } from "./rng";
import { addDays, daysBetween } from "./dates";
import { mean } from "./stats";

/** A historical receivable record with both due and actual paid dates. */
export interface PaidReceivable {
  dueDate: ISODate;
  paidDate: ISODate;
}

/**
 * Fit an empirical days-late distribution from historically-paid receivables.
 * Empirical sampling keeps the model honest about the real spread (no gamma assumption).
 */
export function fitPaymentTiming(history: readonly PaidReceivable[]): PaymentTiming {
  const samples = history.map((r) => Math.max(0, daysBetween(r.dueDate, r.paidDate)));
  const effective = samples.length > 0 ? samples : [0];
  return { daysLateSamples: effective, meanDaysLate: mean(effective) };
}

/** Sample the settlement date for a known outstanding item. */
export function sampleSettlementDate(
  rng: Rng,
  dueDate: ISODate,
  timing: PaymentTiming,
  extraDelayDays: number,
): ISODate {
  const daysLate = sampleFrom(rng, timing.daysLateSamples);
  return addDays(dueDate, daysLate + extraDelayDays);
}
