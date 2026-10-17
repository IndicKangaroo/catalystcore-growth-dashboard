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
