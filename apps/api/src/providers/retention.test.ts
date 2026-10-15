import { metricMissing, metricOk } from '@growth/shared';
import type { MetricValue, RetentionCohort } from '@growth/shared';
import { describe, expect, it } from 'vitest';
import {
  MIN_COHORT_USERS,
  poolCells,
  poolRetention,
  retentionCell,
  retentionWindowEnded,
  weeklyCohortStarts,
} from './retention';

describe('weeklyCohortStarts', () => {
  it('lists the Monday of every week the range touches, oldest first', () => {
    // 2026-10-14 is a Wednesday; its week starts on Monday the 12th.
    expect(weeklyCohortStarts({ from: '2026-09-28', to: '2026-10-14' })).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
  });

  it('starts from the Monday before a range that starts mid-week', () => {
    expect(weeklyCohortStarts({ from: '2026-10-08', to: '2026-10-14' })).toEqual([
      '2026-10-05',
      '2026-10-12',
    ]);
  });

  it('gives one cohort for one day, and treats Sunday as the end of a week', () => {
    expect(weeklyCohortStarts({ from: '2026-10-14', to: '2026-10-14' })).toEqual(['2026-10-12']);
    expect(weeklyCohortStarts({ from: '2026-10-11', to: '2026-10-11' })).toEqual(['2026-10-05']);
  });
});

describe('retentionWindowEnded', () => {
  // The cohort of Monday 2026-10-05 to Sunday 2026-10-11; its day 7 is measured on 2026-10-18.
  it('is not over on the day the last arrival is measured, and is over the day after', () => {
    expect(retentionWindowEnded('2026-10-11', 7, '2026-10-17')).toBe(false);
    expect(retentionWindowEnded('2026-10-11', 7, '2026-10-18')).toBe(false);
    expect(retentionWindowEnded('2026-10-11', 7, '2026-10-19')).toBe(true);
  });

  it('is longer for later days', () => {
    expect(retentionWindowEnded('2026-10-11', 1, '2026-10-13')).toBe(true);
    expect(retentionWindowEnded('2026-10-11', 30, '2026-10-13')).toBe(false);
  });
});

describe('retentionCell', () => {
  const base = { cohortEnd: '2026-10-11', day: 7, today: '2026-10-20', users: 100, fraction: 0.18 };

  it('gives the figure once the window has ended and the cohort is big enough', () => {
    expect(retentionCell(base)).toEqual(metricOk(0.18));
  });

  it('says in progress while the window is still open, however the cohort looks', () => {
    expect(retentionCell({ ...base, today: '2026-10-15' })).toEqual(metricMissing('in_progress'));
    expect(retentionCell({ ...base, today: '2026-10-15', users: 3 })).toEqual(
      metricMissing('in_progress'),
    );
  });

  it('says not enough data for a cohort that is too small', () => {
    expect(retentionCell({ ...base, users: MIN_COHORT_USERS - 1 })).toEqual(
      metricMissing('not_enough_data'),
    );
    expect(retentionCell({ ...base, users: MIN_COHORT_USERS })).toEqual(metricOk(0.18));
  });
});

describe('poolRetention', () => {
  it('weights each cohort by its size', () => {
    const value = poolRetention([
      { users: 100, value: metricOk(0.4) },
      { users: 300, value: metricOk(0.2) },
    ]);
    expect(value).toEqual(metricOk(0.25));
  });

  it('leaves out cohorts that have no figure yet, and still averages the rest', () => {
    const value = poolRetention([
      { users: 100, value: metricOk(0.3) },
      { users: 500, value: metricMissing('in_progress') },
      { users: 50, value: metricMissing('not_enough_data') },
    ]);
    expect(value).toEqual(metricOk(0.3));
  });

  it('is in progress when no window has ended but some are still open', () => {
    const value = poolRetention([
      { users: 100, value: metricMissing('in_progress') },
      { users: 10, value: metricMissing('not_enough_data') },
    ]);
    expect(value).toEqual(metricMissing('in_progress'));
  });

  it('is not enough data when nothing can be averaged and nothing is still open', () => {
    expect(poolRetention([{ users: 10, value: metricMissing('not_enough_data') }])).toEqual(
      metricMissing('not_enough_data'),
    );
    expect(poolRetention([])).toEqual(metricMissing('not_enough_data'));
  });

  it('rounds to four decimals', () => {
    const value: MetricValue = poolRetention([
      { users: 3, value: metricOk(0.1) },
      { users: 1, value: metricOk(0.2) },
    ]);
    expect(value).toEqual(metricOk(0.125));
    expect(poolRetention([{ users: 7, value: metricOk(1 / 3) }])).toEqual(metricOk(0.3333));
  });
});

describe('poolCells', () => {
  const cohort = (users: number, d1: MetricValue, d7: MetricValue): RetentionCohort => ({
    cohortStart: '2026-10-05',
    cohortEnd: '2026-10-11',
    users,
    retention: { d1, d7, d14: metricMissing('in_progress'), d30: metricMissing('in_progress') },
  });

  it('pools each day on its own', () => {
    const cells = poolCells([
      cohort(100, metricOk(0.5), metricOk(0.2)),
      cohort(100, metricOk(0.3), metricMissing('in_progress')),
    ]);
    expect(cells).toEqual({
      d1: metricOk(0.4),
      d7: metricOk(0.2),
      d14: metricMissing('in_progress'),
      d30: metricMissing('in_progress'),
    });
  });

  it('has nothing to say about no cohorts', () => {
    const none = metricMissing('not_enough_data');
    expect(poolCells([])).toEqual({ d1: none, d7: none, d14: none, d30: none });
  });
});
