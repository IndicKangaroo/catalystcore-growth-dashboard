import type { SeriesPoint } from '@growth/shared';
import { formatShortDay } from '../../lib/format';

/** One day on the chart: this period's value and, when comparing, the matching day before it. */
export interface ChartRow {
  date: string;
  label: string;
  current: number | null;
  previous: number | null;
  previousDate: string | null;
}

/**
 * Lines the previous period up under this one, day by day from the start of each, so the first day
 * of the range sits over the first day of the period before it. A day without data stays null, so
 * the line has a gap there and is not drawn down to zero.
 */
export function buildRows(
  current: readonly SeriesPoint[],
  previous: readonly SeriesPoint[] | null,
) {
  return current.map((point, index): ChartRow => {
    const before = previous?.[index];
    return {
      date: point.date,
      label: formatShortDay(point.date),
      current: point.value,
      previous: before?.value ?? null,
      previousDate: before?.date ?? null,
    };
  });
}

/** The day with the highest value; the earliest when two tie. Null when no day has data. */
export function peakOf(points: readonly SeriesPoint[]): SeriesPoint | null {
  let peak: SeriesPoint | null = null;
  for (const point of points) {
    if (point.value === null) continue;
    if (peak === null || (peak.value !== null && point.value > peak.value)) peak = point;
  }
  return peak;
}
