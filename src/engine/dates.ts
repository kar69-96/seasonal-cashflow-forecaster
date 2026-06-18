// ISODate ('YYYY-MM-DD') helpers, all UTC to stay deterministic across timezones.
import type { ISODate } from "@/domain/types";

const MS_PER_DAY = 86_400_000;

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function parseISO(s: ISODate): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDays(s: ISODate, days: number): ISODate {
  return toISO(new Date(parseISO(s).getTime() + days * MS_PER_DAY));
}

/** Whole-day difference b - a (can be negative). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / MS_PER_DAY);
}

/** Month of year, 1..12. */
export function monthOf(s: ISODate): number {
  return parseISO(s).getUTCMonth() + 1;
}

/** Build an inclusive sequence of N+1 daily ISODates starting at `start`. */
export function dateRange(start: ISODate, horizonDays: number): ISODate[] {
  const out: ISODate[] = [];
  for (let i = 0; i <= horizonDays; i++) out.push(addDays(start, i));
  return out;
}
