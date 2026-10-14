import { describe, expect, it } from 'vitest';
import type { DatePreset } from './enums';
import {
  dateRangeSchema,
  daysInRange,
  MAX_RANGE_DAYS,
  rangeProblem,
  resolveDateRange,
} from './dateRange';

// Wednesday 14 October 2026, 12:00 UTC: already the evening in India, still the morning in the US.
const NOW = new Date('2026-10-14T12:00:00Z');

describe('resolveDateRange', () => {
  it('makes "today" a single day', () => {
    expect(resolveDateRange({ kind: 'preset', preset: 'today' }, NOW, 'UTC')).toEqual({
      from: '2026-10-14',
      to: '2026-10-14',
    });
  });

  const presets: [DatePreset, string, number][] = [
    ['7d', '2026-10-08', 7],
    ['30d', '2026-09-15', 30],
    ['90d', '2026-07-17', 90],
  ];
  it.each(presets)('makes %s the days that end today, counting today', (preset, from, length) => {
    const range = resolveDateRange({ kind: 'preset', preset }, NOW, 'UTC');
    expect(range).toEqual({ from, to: '2026-10-14' });
    expect(daysInRange(range)).toBe(length);
  });

  it('ends on the studio’s today, which can differ from the UTC date', () => {
    const lateEvening = new Date('2026-10-14T19:00:00Z'); // 00:30 on the 15th in India
    expect(resolveDateRange({ kind: 'preset', preset: '7d' }, lateEvening, 'Asia/Kolkata')).toEqual(
      { from: '2026-10-09', to: '2026-10-15' },
    );
    expect(resolveDateRange({ kind: 'preset', preset: '7d' }, lateEvening, 'UTC')).toEqual({
      from: '2026-10-08',
      to: '2026-10-14',
    });
  });

  it('keeps a custom range exactly as chosen', () => {
    const spec = { kind: 'custom', from: '2026-01-05', to: '2026-02-10' } as const;
    expect(resolveDateRange(spec, NOW, 'Asia/Kolkata')).toEqual({
      from: '2026-01-05',
      to: '2026-02-10',
    });
  });

  it('reaches back over a year end', () => {
    const newYear = new Date('2027-01-03T10:00:00Z');
    expect(resolveDateRange({ kind: 'preset', preset: '7d' }, newYear, 'UTC')).toEqual({
      from: '2026-12-28',
      to: '2027-01-03',
    });
  });
});

describe('rangeProblem', () => {
  it('accepts one day, and the longest allowed range', () => {
    expect(rangeProblem({ from: '2026-10-14', to: '2026-10-14' })).toBeNull();
    expect(rangeProblem({ from: '2025-10-14', to: '2026-10-14' })).toBeNull();
    expect(daysInRange({ from: '2025-10-14', to: '2026-10-14' })).toBe(366);
  });

  it('refuses a range that ends before it starts', () => {
    expect(rangeProblem({ from: '2026-10-14', to: '2026-10-13' })).toBe(
      'The start date is after the end date',
    );
  });

  it('refuses a range longer than the limit', () => {
    expect(MAX_RANGE_DAYS).toBe(366);
    expect(rangeProblem({ from: '2025-10-13', to: '2026-10-14' })).toBe('Choose at most 366 days');
  });

  it('refuses dates that are not real', () => {
    expect(rangeProblem({ from: '2026-02-31', to: '2026-03-02' })).toContain('real dates');
    expect(rangeProblem({ from: '2026-03-01', to: 'soon' })).toContain('real dates');
  });
});

describe('dateRangeSchema', () => {
  it('accepts a good range', () => {
    expect(dateRangeSchema.parse({ from: '2026-10-01', to: '2026-10-14' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-14',
    });
  });

  it('reports the problem on the end date', () => {
    const result = dateRangeSchema.safeParse({ from: '2026-10-14', to: '2026-10-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['to']);
      expect(result.error.issues[0]?.message).toBe('The start date is after the end date');
    }
  });

  it('rejects a missing date', () => {
    expect(dateRangeSchema.safeParse({ from: '2026-10-01' }).success).toBe(false);
  });
});
