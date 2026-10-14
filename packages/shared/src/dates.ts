import { z } from 'zod';

/**
 * Calendar days. A day is written YYYY-MM-DD and means a day on the studio's wall clock (D-014),
 * never a UTC instant. Moments in time are stored as UTC ISO strings elsewhere; this file is only
 * for "which day was it" questions, so that web and API cut days in the same place.
 */

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMs(date: string): number | null {
  const match = CALENDAR_DATE.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  // Date.UTC rolls 2026-02-31 over to March, so check that the same parts come back.
  const check = new Date(ms);
  const same =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  return same ? ms : null;
}

/** True for a real calendar day written as YYYY-MM-DD ("2026-02-31" is not). */
export function isCalendarDate(value: string): boolean {
  return toUtcMs(value) !== null;
}

export const calendarDateSchema = z
  .string()
  .trim()
  .refine(isCalendarDate, { message: 'Use a real date written like 2026-10-14' });

function requireMs(date: string): number {
  const ms = toUtcMs(date);
  if (ms === null) throw new RangeError(`Not a calendar date: ${date}`);
  return ms;
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The day `days` after `date` (before it when negative). Pure calendar arithmetic, so no DST. */
export function addDays(date: string, days: number): string {
  return fromUtcMs(requireMs(date) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((requireMs(to) - requireMs(from)) / MS_PER_DAY);
}

/** The weekday of a calendar day, 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(requireMs(date)).getUTCDay();
}

/** The Monday on or before `date`. Report weeks run Monday to Sunday (D-014). */
export function mondayOnOrBefore(date: string): string {
  const sinceMonday = (weekdayOf(date) + 6) % 7;
  return addDays(date, -sinceMonday);
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar day it is at `now` in `timeZone`. Throws RangeError for an unknown time zone. */
export function todayIn(timeZone: string, now: Date): string {
  const parts = formatterFor(timeZone).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
