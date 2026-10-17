import {
  acquisitionSchema,
  appUsersSchema,
  campaignOutcomeSchema,
  METRICS,
  overviewSchema,
  retentionSchema,
  seriesSchema,
} from '@growth/shared';
import type { AppRecord, MetricValue, Series, SeriesPoint } from '@growth/shared';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../../testing/apps';
import { createSeedProvider } from './index';

// 2026-10-14 is a Wednesday. The apps cover the cases that matter: always there, launched a
// while ago, launched this week, and not launched yet.
const TODAY = '2026-10-14';
const alpha = makeApp({ id: 'alpha', name: 'Alpha' });
const bravo = makeApp({ id: 'bravo', name: 'Bravo', launchDate: '2026-06-01' });
const charlie = makeApp({ id: 'charlie', name: 'Charlie', launchDate: '2026-10-10' });
const delta = makeApp({ id: 'delta', name: 'Delta', launchDate: '2027-01-01' });
const established = [alpha, bravo];

const provider = createSeedProvider();

const query = (apps: AppRecord[], from: string, to = TODAY) => ({
  apps,
  period: { from, to },
  today: TODAY,
});
const periodOf = (from: string, to = TODAY) => ({ period: { from, to }, today: TODAY });

const THIRTY_DAYS = '2026-09-15';
const NINETY_DAYS = '2026-07-17';
const YEAR = '2025-10-14';

function valueOf(metric: MetricValue): number {
  if (metric.state !== 'ok') throw new Error(`Expected a number, got "${metric.state}"`);
  return metric.value;
}

function pointsOf(series: Series): SeriesPoint[] {
  if (series.data.state !== 'ok') throw new Error(`Expected points, got "${series.data.state}"`);
  return series.data.points;
}

const total = (numbers: number[]) => numbers.reduce((all, value) => all + value, 0);

const sumOfPoints = (series: Series) => total(pointsOf(series).map((point) => point.value ?? 0));

describe('the contract', () => {
  const ranges = [
    ['today', TODAY],
    ['30 days', THIRTY_DAYS],
    ['90 days', NINETY_DAYS],
    ['a year', YEAR],
  ];

  it.each(ranges)(
    'answers every question in the shape the screens expect, for %s',
    async (_name, from) => {
      const q = query([alpha, bravo, charlie, delta], from);
      const one = periodOf(from);

      const overview = await provider.getOverview(q);
      expect(overviewSchema.parse(overview)).toEqual(overview);

      for (const metric of METRICS) {
        const series = await provider.getTimeSeries(q, metric);
        expect(seriesSchema.parse(series)).toEqual(series);
      }

      for (const app of [alpha, bravo, charlie, delta]) {
        const users = await provider.getAppUsers(app, one);
        expect(appUsersSchema.parse(users)).toEqual(users);
        const retention = await provider.getRetention(app, one);
        expect(retentionSchema.parse(retention)).toEqual(retention);
      }

      const acquisition = await provider.getAcquisition(q);
      expect(acquisitionSchema.parse(acquisition)).toEqual(acquisition);

      const outcome = await provider.getCampaignUsers(
        alpha,
        { source: 'instagram', medium: 'social', campaign: 'launch' },
        one,
      );
      expect(campaignOutcomeSchema.parse(outcome)).toEqual(outcome);
    },
  );

  it('says every answer comes from the seed provider, which is how the screens label demo data', async () => {
    const q = query(established, THIRTY_DAYS);
    const answers = [
      await provider.getOverview(q),
      await provider.getTimeSeries(q, 'sessions'),
      await provider.getAppUsers(alpha, periodOf(THIRTY_DAYS)),
      await provider.getRetention(alpha, periodOf(THIRTY_DAYS)),
      await provider.getAcquisition(q),
      await provider.getCampaignUsers(
        alpha,
        { source: 'youtube', medium: 'social', campaign: 'demo' },
        periodOf(THIRTY_DAYS),
      ),
    ];

    expect(provider.name).toBe('seed');
    expect(answers.map((answer) => answer.source)).toEqual(Array(6).fill('seed'));
  });
});

describe('being the same every time', () => {
  it('gives the same answer twice, from two providers, in any order', async () => {
    const other = createSeedProvider();
    const q = query(established, THIRTY_DAYS);

    const seriesFirst = await provider.getTimeSeries(q, 'new_users');
    const overview = await provider.getOverview(q);
    const overviewFirst = await other.getOverview(q);
    const seriesSecond = await other.getTimeSeries(q, 'new_users');

    expect(overview).toEqual(overviewFirst);
    expect(seriesFirst).toEqual(seriesSecond);
  });

  it('gives an app the same figures whichever apps it is asked about with', async () => {
    const alone = await provider.getOverview(query([alpha], THIRTY_DAYS));
    const withOthers = await provider.getAppUsers(alpha, periodOf(THIRTY_DAYS));

    expect(valueOf(alone.newUsers)).toBe(valueOf(withOthers.newUsers));
    expect(valueOf(alone.sessions)).toBe(valueOf(withOthers.sessions));
  });

  it('gives apps their own figures', async () => {
    const a = await provider.getTimeSeries(query([alpha], THIRTY_DAYS), 'active_users');
    const b = await provider.getTimeSeries(query([bravo], THIRTY_DAYS), 'active_users');

    expect(pointsOf(a)).not.toEqual(pointsOf(b));
  });

  it('gives a day the same figure whichever range it is part of', async () => {
    const short = pointsOf(await provider.getTimeSeries(query([alpha], '2026-10-01'), 'sessions'));
    const long = pointsOf(await provider.getTimeSeries(query([alpha], '2026-09-01'), 'sessions'));

    for (const point of short) {
      expect(long.find((other) => other.date === point.date)).toEqual(point);
    }
  });
});

describe('what the figures look like', () => {
  it('gives whole, sensible numbers', async () => {
    const q = query(established, THIRTY_DAYS);
    const overview = await provider.getOverview(q);

    for (const metric of [overview.activeUsers, overview.newUsers, overview.sessions]) {
      expect(Number.isInteger(valueOf(metric))).toBe(true);
      expect(valueOf(metric)).toBeGreaterThan(0);
    }
    expect(valueOf(overview.newUsers)).toBeLessThan(valueOf(overview.activeUsers));
  });

  it('draws a point for every day of the range, oldest first', async () => {
    const series = await provider.getTimeSeries(query([alpha], '2026-10-01'), 'active_users');

    expect(pointsOf(series).map((point) => point.date)).toEqual(
      Array.from({ length: 14 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`),
    );
  });

  it('has a weekly rhythm that is different for every app', async () => {
    const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
    const mean = (list: SeriesPoint[]) =>
      total(list.map((point) => point.value ?? 0)) / Math.max(1, list.length);

    const lifts = await Promise.all(
      Array.from({ length: 8 }, (_, index) => makeApp({ id: `rhythm-${index}` })).map(
        async (app) => {
          const points = pointsOf(
            await provider.getTimeSeries(query([app], '2026-08-17', '2026-10-04'), 'active_users'),
          );
          const weekend = points.filter((point) => [0, 6].includes(dayOfWeek(point.date)));
          const weekday = points.filter((point) => ![0, 6].includes(dayOfWeek(point.date)));
          return mean(weekend) / mean(weekday);
        },
      ),
    );

    // Some apps gain at the weekend and some lose, by more than the day-to-day noise.
    expect(Math.max(...lifts)).toBeGreaterThan(1.05);
    expect(Math.min(...lifts)).toBeLessThan(0.95);
  });

  it('keeps DAU, WAU and MAU in order', async () => {
    for (const app of [alpha, bravo, charlie]) {
      const users = await provider.getAppUsers(app, periodOf(THIRTY_DAYS));

      expect(valueOf(users.dau)).toBeLessThanOrEqual(valueOf(users.wau));
      expect(valueOf(users.wau)).toBeLessThanOrEqual(valueOf(users.mau));
    }
  });

  it('counts the people who come back as well as the new ones', async () => {
    const users = await provider.getAppUsers(alpha, periodOf(THIRTY_DAYS));

    expect(valueOf(users.returningUsers)).toBeGreaterThan(0);
    expect(valueOf(users.sessionsPerUser)).toBeGreaterThan(1);
    expect(valueOf(users.averageEngagementSeconds)).toBeGreaterThan(30);
  });
});

describe('figures that add up', () => {
  const q = query([alpha, bravo, charlie], THIRTY_DAYS);

  it('totals new users and sessions the same way in the overview, the apps and the chart', async () => {
    const overview = await provider.getOverview(q);
    const apps = await Promise.all(
      [alpha, bravo, charlie].map((app) => provider.getAppUsers(app, periodOf(THIRTY_DAYS))),
    );

    expect(valueOf(overview.newUsers)).toBe(total(apps.map((app) => valueOf(app.newUsers))));
    expect(valueOf(overview.sessions)).toBe(total(apps.map((app) => valueOf(app.sessions))));
    expect(valueOf(overview.newUsers)).toBe(
      sumOfPoints(await provider.getTimeSeries(q, 'new_users')),
    );
    expect(valueOf(overview.sessions)).toBe(
      sumOfPoints(await provider.getTimeSeries(q, 'sessions')),
    );
  });

  it('counts every active person, new or returning, once', async () => {
    const overview = await provider.getOverview(q);
    const apps = await Promise.all(
      [alpha, bravo, charlie].map((app) => provider.getAppUsers(app, periodOf(THIRTY_DAYS))),
    );

    expect(valueOf(overview.activeUsers)).toBe(
      total(apps.map((app) => valueOf(app.newUsers) + valueOf(app.returningUsers))),
    );
  });

  it('makes the last day of the chart the apps’ DAU', async () => {
    const series = pointsOf(await provider.getTimeSeries(q, 'active_users'));
    const apps = await Promise.all(
      [alpha, bravo, charlie].map((app) => provider.getAppUsers(app, periodOf(THIRTY_DAYS))),
    );

    expect(series[series.length - 1]?.value).toBe(total(apps.map((app) => valueOf(app.dau))));
  });

  it('accounts for every new user in the acquisition table, and every attributed user in the social rows', async () => {
    const overview = await provider.getOverview(q);
    const acquisition = await provider.getAcquisition(q);
    if (acquisition.data.state !== 'ok') throw new Error('Expected rows');
    const { rows } = acquisition.data;

    expect(total(rows.map((row) => row.users))).toBe(valueOf(overview.newUsers));
    expect(total(rows.filter((row) => row.channel === 'social').map((row) => row.users))).toBe(
      valueOf(overview.attributedUsers),
    );
    expect(valueOf(overview.attributedUsers)).toBe(
      sumOfPoints(await provider.getTimeSeries(q, 'attributed_users')),
    );
  });

  it('lists measured rows only, biggest first, and says campaign details were reported', async () => {
    const acquisition = await provider.getAcquisition(q);
    if (acquisition.data.state !== 'ok') throw new Error('Expected rows');
    const { rows, measuredAttribution } = acquisition.data;

    expect(measuredAttribution).toBe(true);
    expect(new Set(rows.map((row) => row.provenance))).toEqual(new Set(['measured']));
    expect(rows.map((row) => row.users)).toEqual(
      [...rows.map((row) => row.users)].sort((a, b) => b - a),
    );
    expect(rows.every((row) => row.users > 0)).toBe(true);
    expect(rows.filter((row) => row.channel === 'social').every((row) => row.source !== null)).toBe(
      true,
    );
    expect(rows.filter((row) => row.channel !== 'social').every((row) => row.source === null)).toBe(
      true,
    );
  });

  it('averages day 7 retention over every app’s finished cohorts, weighted by their size', async () => {
    const overview = await provider.getOverview(q);
    const cohorts = (
      await Promise.all(
        [alpha, bravo, charlie].map((app) => provider.getRetention(app, periodOf(THIRTY_DAYS))),
      )
    ).flatMap((retention) => retention.cohorts);

    let users = 0;
    let weighted = 0;
    for (const cohort of cohorts) {
      if (cohort.retention.d7.state === 'ok') {
        users += cohort.users;
        weighted += cohort.users * cohort.retention.d7.value;
      }
    }
    expect(users).toBeGreaterThan(0);
    expect(valueOf(overview.averageRetention)).toBeCloseTo(weighted / users, 3);
  });
});

describe('retention', () => {
  it('uses weekly cohorts that run Monday to Sunday', async () => {
    const retention = await provider.getRetention(alpha, periodOf(NINETY_DAYS));

    expect(retention.cohorts.length).toBeGreaterThan(10);
    for (const cohort of retention.cohorts) {
      expect(new Date(`${cohort.cohortStart}T00:00:00Z`).getUTCDay()).toBe(1);
      expect(new Date(`${cohort.cohortEnd}T00:00:00Z`).getUTCDay()).toBe(0);
      expect(cohort.users).toBeGreaterThan(0);
    }
    const starts = retention.cohorts.map((cohort) => cohort.cohortStart);
    expect(starts).toEqual([...starts].sort());
  });

  it('lets fewer people come back each day, never more', async () => {
    const retention = await provider.getRetention(bravo, periodOf(NINETY_DAYS));
    let checked = 0;

    for (const { retention: cells } of retention.cohorts) {
      const day = [cells.d1, cells.d7, cells.d14, cells.d30];
      for (let index = 1; index < day.length; index += 1) {
        const earlier = day[index - 1];
        const later = day[index];
        if (earlier?.state === 'ok' && later?.state === 'ok') {
          expect(later.value).toBeLessThanOrEqual(earlier.value);
          expect(later.value).toBeGreaterThan(0);
          checked += 1;
        }
      }
      if (cells.d1.state === 'ok') expect(cells.d1.value).toBeLessThan(1);
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('says in progress for a window that has not ended, never a number', async () => {
    const retention = await provider.getRetention(alpha, periodOf('2026-09-28'));
    const byStart = new Map(retention.cohorts.map((cohort) => [cohort.cohortStart, cohort]));

    // The week of 2026-10-12 is still going: not even its day 1 is final.
    expect(byStart.get('2026-10-12')?.retention.d1).toEqual({ state: 'in_progress' });
    expect(byStart.get('2026-10-12')?.retention.d30).toEqual({ state: 'in_progress' });
    // The week of 2026-10-05 ended on the 11th: day 1 is final, day 7 is measured on the 18th.
    expect(byStart.get('2026-10-05')?.retention.d1.state).toBe('ok');
    expect(byStart.get('2026-10-05')?.retention.d7).toEqual({ state: 'in_progress' });
    // The week of 2026-09-28 ended on 10-04: day 7 was final on 10-12, day 14 on 10-19.
    expect(byStart.get('2026-09-28')?.retention.d7.state).toBe('ok');
    expect(byStart.get('2026-09-28')?.retention.d14).toEqual({ state: 'in_progress' });
  });

  it('has no figure for any day of a range that is all in progress', async () => {
    const retention = await provider.getRetention(alpha, periodOf('2026-10-12'));

    expect(retention.summary).toEqual({
      d1: { state: 'in_progress' },
      d7: { state: 'in_progress' },
      d14: { state: 'in_progress' },
      d30: { state: 'in_progress' },
    });
    const overview = await provider.getOverview(query([alpha], '2026-10-12'));
    expect(overview.averageRetention).toEqual({ state: 'in_progress' });
  });
});

describe('a missing number is a state, never zero', () => {
  it('has no days before an app launched', async () => {
    const series = await provider.getTimeSeries(query([charlie], '2026-10-06'), 'active_users');
    const points = pointsOf(series);

    expect(points.filter((point) => point.date < '2026-10-10').map((point) => point.value)).toEqual(
      [null, null, null, null],
    );
    expect(
      points.filter((point) => point.date >= '2026-10-10').every((p) => (p.value ?? 0) > 0),
    ).toBe(true);
  });

  it('has no days that have not happened yet', async () => {
    const series = await provider.getTimeSeries(
      query([alpha], '2026-10-13', '2026-10-17'),
      'sessions',
    );
    const points = pointsOf(series);

    expect(points.map((point) => point.value !== null)).toEqual([true, true, false, false, false]);
  });

  it('reads DAU, WAU and MAU from the last day that has happened', async () => {
    const users = await provider.getAppUsers(alpha, periodOf('2026-10-01', '2026-10-30'));
    const today = await provider.getAppUsers(alpha, periodOf('2026-10-01', TODAY));

    expect(users.dau).toEqual(today.dau);
    expect(users.mau).toEqual(today.mau);
  });

  it('says not enough data for an app that has not launched', async () => {
    const none = { state: 'not_enough_data' };
    const users = await provider.getAppUsers(delta, periodOf(THIRTY_DAYS));

    expect(users).toMatchObject({
      dau: none,
      wau: none,
      mau: none,
      newUsers: none,
      returningUsers: none,
      sessions: none,
      sessionsPerUser: none,
      averageEngagementSeconds: none,
    });

    const retention = await provider.getRetention(delta, periodOf(THIRTY_DAYS));
    expect(retention.cohorts).toEqual([]);
    expect(retention.summary.d7).toEqual(none);

    const outcome = await provider.getCampaignUsers(
      delta,
      { source: 'reddit', medium: 'social', campaign: 'soon' },
      periodOf(THIRTY_DAYS),
    );
    expect(outcome).toMatchObject({
      attributedUsers: none,
      engagedUsers: none,
      retainedUsers: none,
    });
  });

  it('says not enough data when none of the apps asked about has figures', async () => {
    const q = query([delta], THIRTY_DAYS);
    const none = { state: 'not_enough_data' };

    const overview = await provider.getOverview(q);
    expect(overview).toMatchObject({
      appsWithData: 0,
      activeUsers: none,
      newUsers: none,
      sessions: none,
      averageRetention: none,
      attributedUsers: none,
    });
    expect((await provider.getTimeSeries(q, 'new_users')).data).toEqual(none);
    expect((await provider.getAcquisition(q)).data).toEqual(none);
  });

  it('counts the apps that have figures, and uses only those', async () => {
    const withDelta = await provider.getOverview(query([alpha, delta], THIRTY_DAYS));
    const without = await provider.getOverview(query([alpha], THIRTY_DAYS));

    expect(withDelta.appsWithData).toBe(1);
    expect(withDelta.newUsers).toEqual(without.newUsers);
  });

  it('says not connected, not zero, when there are no apps', async () => {
    const none = { state: 'not_connected' };
    const q = query([], THIRTY_DAYS);

    const overview = await provider.getOverview(q);
    expect(overview).toMatchObject({
      appsWithData: 0,
      activeUsers: none,
      newUsers: none,
      sessions: none,
      averageRetention: none,
      attributedUsers: none,
    });
    expect((await provider.getTimeSeries(q, 'sessions')).data).toEqual(none);
    expect((await provider.getAcquisition(q)).data).toEqual(none);
  });

  it('never invents installs or revenue, which need integrations that do not exist yet', async () => {
    for (const apps of [established, [delta], []]) {
      const overview = await provider.getOverview(query(apps, THIRTY_DAYS));

      expect(overview.installs).toEqual({ state: 'not_connected' });
      expect(overview.revenue).toEqual({ state: 'not_connected' });
    }
  });
});

describe('campaign outcomes', () => {
  const utm = { source: 'instagram', medium: 'social', campaign: 'spring_launch' };

  it('narrows from attributed to engaged to retained', async () => {
    const outcome = await provider.getCampaignUsers(alpha, utm, periodOf(THIRTY_DAYS));

    expect(outcome.provenance).toBe('measured');
    expect(outcome.utm).toEqual(utm);
    expect(valueOf(outcome.attributedUsers)).toBeGreaterThan(0);
    expect(valueOf(outcome.engagedUsers)).toBeLessThanOrEqual(valueOf(outcome.attributedUsers));
    expect(valueOf(outcome.retainedUsers)).toBeLessThanOrEqual(valueOf(outcome.engagedUsers));
  });

  it('is the same every time and different for another link', async () => {
    const first = await provider.getCampaignUsers(alpha, utm, periodOf(THIRTY_DAYS));
    const again = await provider.getCampaignUsers(alpha, utm, periodOf(THIRTY_DAYS));
    const other = await provider.getCampaignUsers(
      alpha,
      { ...utm, campaign: 'summer_sale', content: 'reel_2' },
      periodOf(THIRTY_DAYS),
    );

    expect(again).toEqual(first);
    expect(other.attributedUsers).not.toEqual(first.attributedUsers);
  });
});
