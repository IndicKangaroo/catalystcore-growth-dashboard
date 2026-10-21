import { vi } from 'vitest';
import { addDays, metricMissing, metricOk } from '@growth/shared';
import type {
  AppUsers,
  DateRange,
  Metric,
  Overview,
  Retention,
  RetentionCohort,
  Series,
  SeriesPoint,
} from '@growth/shared';

/** The seven days to 15 October 2026, which is "Last 7 days" on that day in Asia/Kolkata. */
export const WEEK: DateRange = { from: '2026-10-09', to: '2026-10-15' };
/** The seven days before WEEK: what "compare to previous period" asks for. */
export const WEEK_BEFORE: DateRange = { from: '2026-10-02', to: '2026-10-08' };

/** A moment that is midday on 15 October 2026 where the studio is (Asia/Kolkata). */
export function setClockToMiddayInKolkata() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T06:30:00Z'));
}

/** What GET /api/metrics/overview answers: demo data, a number for most things. */
export function makeOverview(overrides: Partial<Overview> = {}): Overview {
  return {
    source: 'seed',
    range: WEEK,
    appsWithData: 2,
    appsNotConnected: [],
    activeUsers: metricOk(12_900),
    newUsers: metricOk(3_400),
    sessions: metricOk(48_210),
    installs: metricMissing('not_connected'),
    averageRetention: metricOk(0.234),
    revenue: metricMissing('not_connected'),
    attributedUsers: metricMissing('no_measured_attribution'),
    ...overrides,
  };
}

/** One point per day from `range.from` to `range.to`, valued by `valueAt(dayIndex)`. */
export function makePoints(
  range: DateRange,
  valueAt: (index: number) => number | null = (index) => 100 + index * 10,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (let index = 0; addDays(range.from, index) <= range.to; index++) {
    points.push({ date: addDays(range.from, index), value: valueAt(index) });
  }
  return points;
}

export function makeSeries(
  metric: Metric = 'active_users',
  points: SeriesPoint[] = makePoints(WEEK),
): Series {
  return { source: 'seed', metric, range: WEEK, data: { state: 'ok', points } };
}

export function makeAppUsers(overrides: Partial<AppUsers> = {}): AppUsers {
  return {
    source: 'seed',
    appId: 'quest',
    range: WEEK,
    dau: metricOk(820),
    wau: metricOk(3_100),
    mau: metricOk(9_800),
    newUsers: metricOk(1_200),
    returningUsers: metricOk(2_600),
    sessions: metricOk(21_500),
    sessionsPerUser: metricOk(2.46),
    averageEngagementSeconds: metricOk(125),
    ...overrides,
  };
}

export function makeCohort(overrides: Partial<RetentionCohort> = {}): RetentionCohort {
  return {
    cohortStart: '2026-09-28',
    cohortEnd: '2026-10-04',
    users: 410,
    retention: {
      d1: metricOk(0.42),
      d7: metricOk(0.21),
      d14: metricMissing('in_progress'),
      d30: metricMissing('in_progress'),
    },
    ...overrides,
  };
}

export function makeRetention(overrides: Partial<Retention> = {}): Retention {
  return {
    source: 'seed',
    appId: 'quest',
    range: WEEK,
    summary: {
      d1: metricOk(0.4),
      d7: metricOk(0.2),
      d14: metricMissing('in_progress'),
      d30: metricMissing('not_enough_data'),
    },
    cohorts: [makeCohort()],
    ...overrides,
  };
}
