import { z } from 'zod';
import { addDays, calendarDateSchema, daysBetween, isCalendarDate, todayIn } from './dates';
import type { DatePreset } from './enums';

/** The longest range a person can ask for (D-032). It protects providers and keeps charts readable. */
export const MAX_RANGE_DAYS = 366;

/** How many calendar days each quick range covers, counting today. */
const PRESET_DAYS: Record<DatePreset, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

/** A span of calendar days, both ends included. */
export interface DateRange {
  from: string;
  to: string;
}

/** What a person picked: a quick range that moves with the calendar, or fixed dates. */
export type RangeSpec =
  | { kind: 'preset'; preset: DatePreset }
  | { kind: 'custom'; from: string; to: string };

export function daysInRange(range: DateRange): number {
  return daysBetween(range.from, range.to) + 1;
}

/** What is wrong with a range, in words for the person who chose it, or null when it is fine. */
export function rangeProblem(range: DateRange): string | null {
  if (!isCalendarDate(range.from) || !isCalendarDate(range.to)) {
    return 'Use real dates written like 2026-10-14';
  }
  if (range.from > range.to) return 'The start date is after the end date';
  if (daysInRange(range) > MAX_RANGE_DAYS) return `Choose at most ${MAX_RANGE_DAYS} days`;
  return null;
}

/**
 * Turns a choice into days. "7 days" is the seven calendar days that end today, so it includes
 * today; today is cut where the studio is (D-014), which is why the time zone is needed.
 */
export function resolveDateRange(spec: RangeSpec, now: Date, timeZone: string): DateRange {
  if (spec.kind === 'custom') return { from: spec.from, to: spec.to };
  const to = todayIn(timeZone, now);
  return { from: addDays(to, 1 - PRESET_DAYS[spec.preset]), to };
}

export const dateRangeSchema = z
  .object({ from: calendarDateSchema, to: calendarDateSchema })
  .superRefine((range, context) => {
    const problem = rangeProblem(range);
    if (problem) context.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ['to'] });
  });
