import { describe, expect, it } from 'vitest';
import { buildRows, peakOf } from './chartData';

const point = (date: string, value: number | null) => ({ date, value });

describe('buildRows', () => {
  it('puts each day of the previous period under the same day of this one', () => {
    const rows = buildRows(
      [point('2026-10-02', 20), point('2026-10-03', 30)],
      [point('2026-10-01', 10), point('2026-10-02', 15)],
    );

    expect(rows).toEqual([
      { date: '2026-10-02', label: '2 Oct', current: 20, previous: 10, previousDate: '2026-10-01' },
      { date: '2026-10-03', label: '3 Oct', current: 30, previous: 15, previousDate: '2026-10-02' },
    ]);
  });

  it('has no previous values when not comparing', () => {
    const rows = buildRows([point('2026-10-02', 20)], null);

    expect(rows[0]).toMatchObject({ current: 20, previous: null, previousDate: null });
  });

  it('keeps a day without data as a gap, not as zero', () => {
    const rows = buildRows([point('2026-10-02', null)], [point('2026-10-01', null)]);

    expect(rows[0]).toMatchObject({ current: null, previous: null });
  });

  it('leaves the end empty when the previous period is shorter', () => {
    const rows = buildRows(
      [point('2026-10-02', 1), point('2026-10-03', 2)],
      [point('2026-10-01', 5)],
    );

    expect(rows[1]).toMatchObject({ previous: null, previousDate: null });
  });
});

describe('peakOf', () => {
  it('finds the highest day', () => {
    expect(peakOf([point('a', 3), point('b', 9), point('c', 5)])).toEqual(point('b', 9));
  });

  it('takes the earliest day when two tie', () => {
    expect(peakOf([point('a', 9), point('b', 9)])).toEqual(point('a', 9));
  });

  it('passes over days without data, and a real zero can be the peak', () => {
    expect(peakOf([point('a', null), point('b', 0)])).toEqual(point('b', 0));
  });

  it('finds nothing when no day has data', () => {
    expect(peakOf([point('a', null)])).toBeNull();
    expect(peakOf([])).toBeNull();
  });
});
