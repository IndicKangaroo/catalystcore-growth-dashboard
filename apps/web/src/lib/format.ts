import { isCalendarDate } from '@growth/shared';
import type { DateRange } from '@growth/shared';

// Written out rather than taken from Intl: the short month names differ between browsers and
// versions ("Sep" or "Sept"), and a screen should read the same everywhere.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-15" as "15 Oct 2026". Anything that is not a calendar day comes back unchanged. */
export function formatDay(day: string): string {
  if (!isCalendarDate(day)) return day;
  const [year, month, date] = day.split('-');
  return `${Number(date)} ${MONTHS[Number(month) - 1]} ${year}`;
}

/** "1 Oct 2026 – 15 Oct 2026", or a single day when both ends are the same day. */
export function formatDayRange(range: DateRange): string {
  return range.from === range.to
    ? formatDay(range.from)
    : `${formatDay(range.from)} – ${formatDay(range.to)}`;
}

/** Up to two capital letters for an avatar: "Ada Admin" gives "AA", "grace@example.com" gives "G". */
export function initialsOf(text: string): string {
  const base = text.includes('@') ? text.slice(0, text.indexOf('@')) : text;
  const words = base.split(/[\s._-]+/).filter((word) => word.length > 0);
  const first = words[0]?.[0] ?? '?';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

const trimOne = (value: number) => String(Math.round(value * 10) / 10);

/** A count for a card: 1,284 stays whole, 12,900 becomes 12.9K, 4,200,000 becomes 4.2M. */
export function formatCount(value: number): string {
  const size = Math.abs(value);
  if (size >= 999_950) return `${trimOne(value / 1_000_000)}M`;
  if (size >= 10_000) return `${trimOne(value / 1_000)}K`;
  return Math.round(value).toLocaleString('en-US');
}

/** A fraction as a percentage with one decimal: 0.2345 is "23.5%". */
export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

/** A change as a signed percentage. A change that rounds to nothing has no sign: "0.0%". */
export function formatSignedPercent(fraction: number): string {
  const text = formatPercent(Math.abs(fraction));
  if (Math.round(fraction * 1000) === 0) return text;
  return fraction > 0 ? `+${text}` : `-${text}`;
}

/** A length of time in seconds as "45s", "2m 05s" or "1h 02m". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  if (minutes < 60) return `${minutes}m ${pad(seconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
}

/** "2026-10-15" as "15 Oct", for a chart axis where the year is clear from the range. */
export function formatShortDay(day: string): string {
  if (!isCalendarDate(day)) return day;
  const [, month, date] = day.split('-');
  return `${Number(date)} ${MONTHS[Number(month) - 1]}`;
}
