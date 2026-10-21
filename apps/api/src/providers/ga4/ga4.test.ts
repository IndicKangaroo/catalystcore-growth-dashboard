import { describe, expect, it } from 'vitest';
import { makeApp } from '../../testing/apps';
import { createMemorySnapshotStore } from '../../testing/memorySnapshotStore';
import { createGa4Provider, utmFilter } from './index';
import { fakeGa4Client, hasDimension, hasMetric, report, row } from './testing';

const TODAY = '2026-10-21';
const period = { from: '2026-10-01', to: '2026-10-07' };
const query = { period, today: TODAY };

const grind = makeApp({ id: 'a1', name: 'GrindQuest', ga4PropertyId: '111' });
const puzzle = makeApp({ id: 'a2', name: 'Puzzle Pop', ga4PropertyId: '222' });
const unlinked = makeApp({ id: 'a3', name: 'Unlinked' });

/** Totals for a property: active, new, sessions, engagement seconds. */
const totals = (active: number, fresh: number, sessions: number, seconds: number) =>
  report(row([], [active, fresh, sessions, seconds]));

describe('getOverview', () => {
  it('adds up the apps that are connected and names the one that is not', async () => {
    const client = fakeGa4Client((propertyId, request) => {
      if (request.cohortSpec) return report();
      return propertyId === '111' ? totals(100, 40, 300, 6000) : totals(50, 10, 90, 900);
    });
    const provider = createGa4Provider({ client });

    const overview = await provider.getOverview({ ...query, apps: [grind, puzzle, unlinked] });

    expect(overview.source).toBe('ga4');
    expect(overview.appsWithData).toBe(2);
    expect(overview.appsNotConnected).toEqual(['Unlinked']);
    expect(overview.activeUsers).toEqual({ state: 'ok', value: 150 });
    expect(overview.newUsers).toEqual({ state: 'ok', value: 50 });
    expect(overview.sessions).toEqual({ state: 'ok', value: 390 });
  });

  it('never invents installs, revenue or attribution', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => totals(1, 1, 1, 1)) });

    const overview = await provider.getOverview({ ...query, apps: [grind] });

    expect(overview.installs).toEqual({ state: 'not_connected' });
    expect(overview.revenue).toEqual({ state: 'not_connected' });
    expect(overview.attributedUsers).toEqual({ state: 'no_measured_attribution' });
  });

  it('names an app GA4 refuses to read instead of failing the whole page', async () => {
    const client = fakeGa4Client((propertyId, request) => {
      if (propertyId === '222') throw new Error('refused');
      return request.cohortSpec ? report() : totals(100, 40, 300, 6000);
    });
    const provider = createGa4Provider({ client });

    const overview = await provider.getOverview({ ...query, apps: [grind, puzzle] });

    expect(overview.appsWithData).toBe(1);
    expect(overview.appsNotConnected).toEqual(['Puzzle Pop']);
  });

  it('says not connected, not zero, when no app has a property', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => report()) });

    const overview = await provider.getOverview({ ...query, apps: [unlinked] });

    expect(overview.activeUsers).toEqual({ state: 'not_connected' });
    expect(overview.appsNotConnected).toEqual(['Unlinked']);
  });

  it('says not enough data when GA4 returns nothing for the days', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => report()) });

    const overview = await provider.getOverview({ ...query, apps: [grind] });

    expect(overview.activeUsers).toEqual({ state: 'not_enough_data' });
  });
});

describe('getTimeSeries', () => {
  const daily = report(row(['20261001'], [10, 4, 20, 100]), row(['20261002'], [20, 6, 40, 400]));

  it('gives one point per day, and null for a day GA4 has no row for', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => daily) });

    const series = await provider.getTimeSeries({ ...query, apps: [grind] }, 'active_users');

    expect(series.data.state).toBe('ok');
    if (series.data.state !== 'ok') return;
    expect(series.data.points).toHaveLength(7);
    expect(series.data.points[0]).toEqual({ date: '2026-10-01', value: 10 });
    expect(series.data.points[2]).toEqual({ date: '2026-10-03', value: null });
  });

  it('averages engagement per active user, not per day', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => daily) });

    const series = await provider.getTimeSeries({ ...query, apps: [grind] }, 'engagement_time');

    if (series.data.state !== 'ok') throw new Error('expected data');
    expect(series.data.points[1]?.value).toBe(20);
  });

  it('has no measured attribution until campaigns are registered', async () => {
    const client = fakeGa4Client(() => daily);
    const provider = createGa4Provider({ client });

    const series = await provider.getTimeSeries({ ...query, apps: [grind] }, 'attributed_users');

    expect(series.data).toEqual({ state: 'no_measured_attribution' });
    expect(client.calls).toHaveLength(0);
  });

  it('reports the GA4 failure when every connected app fails', async () => {
    const provider = createGa4Provider({
      client: fakeGa4Client(() => {
        throw new Error('GA4 refused access');
      }),
    });

    await expect(provider.getTimeSeries({ ...query, apps: [grind] }, 'sessions')).rejects.toThrow(
      'GA4 refused access',
    );
  });

  it('keeps settled days and reads only what is still missing', async () => {
    const snapshots = createMemorySnapshotStore();
    const client = fakeGa4Client(() =>
      report(row(['20261001'], [10, 4, 20, 100]), row(['20261020'], [30, 5, 50, 300])),
    );
    const provider = createGa4Provider({ client, snapshots });
    const wide = { period: { from: '2026-10-01', to: '2026-10-21' }, today: TODAY };

    await provider.getTimeSeries({ ...wide, apps: [grind] }, 'active_users');

    // 10-01 is settled and saved; 10-20 is within the last three days, so it is not kept.
    expect([...snapshots.saved.keys()]).toEqual(['a1_2026-10-01']);

    const again = fakeGa4Client(() => report(row(['20261002'], [1, 1, 1, 1])));
    await createGa4Provider({ client: again, snapshots }).getTimeSeries(
      { ...wide, apps: [grind] },
      'active_users',
    );
    expect(again.calls[0]?.request.dateRanges?.[0]?.startDate).toBe('2026-10-02');
  });

  it('ignores days saved for a different property', async () => {
    const snapshots = createMemorySnapshotStore();
    await snapshots.write('a1', '999', [
      { date: '2026-10-01', activeUsers: 5, newUsers: 5, sessions: 5, engagementSeconds: 5 },
    ]);
    const client = fakeGa4Client(() => report(row(['20261001'], [10, 4, 20, 100])));

    const series = await createGa4Provider({ client, snapshots }).getTimeSeries(
      { ...query, apps: [grind] },
      'active_users',
    );

    if (series.data.state !== 'ok') throw new Error('expected data');
    expect(series.data.points[0]?.value).toBe(10);
  });
});

describe('getAppUsers', () => {
  it('reads DAU, WAU and MAU from GA4 for the last day of the range', async () => {
    const client = fakeGa4Client((_id, request) =>
      hasMetric(request, 'active28DayUsers')
        ? report(row([], [10, 40, 120]))
        : totals(80, 30, 200, 8000),
    );
    const provider = createGa4Provider({ client });

    const users = await provider.getAppUsers(grind, query);

    expect(users.dau).toEqual({ state: 'ok', value: 10 });
    expect(users.wau).toEqual({ state: 'ok', value: 40 });
    expect(users.mau).toEqual({ state: 'ok', value: 120 });
    expect(users.returningUsers).toEqual({ state: 'ok', value: 50 });
    expect(users.sessionsPerUser).toEqual({ state: 'ok', value: 2.5 });
    expect(users.averageEngagementSeconds).toEqual({ state: 'ok', value: 100 });
    const windows = client.calls.find((call) => hasMetric(call.request, 'active1DayUsers'));
    expect(windows?.request.dateRanges?.[0]).toEqual({
      startDate: '2026-10-07',
      endDate: '2026-10-07',
    });
  });

  it('says not connected for an app without a property, and not enough data for a future range', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => report()) });

    expect((await provider.getAppUsers(unlinked, query)).dau).toEqual({ state: 'not_connected' });
    const future = { period: { from: '2026-11-01', to: '2026-11-07' }, today: TODAY };
    expect((await provider.getAppUsers(grind, future)).dau).toEqual({ state: 'not_enough_data' });
  });
});

describe('getRetention', () => {
  const cohortRows = (name: string, total: number, byDay: Record<number, number>) =>
    Object.entries(byDay).map(([day, active]) =>
      row([name, String(day).padStart(4, '0')], [active, total]),
    );

  it('turns cohort rows into fractions, and shows a window that has not ended as in progress', async () => {
    const client = fakeGa4Client(() =>
      report(
        ...cohortRows('2026-09-07', 100, { 0: 100, 1: 40, 7: 20, 14: 10, 30: 5 }),
        ...cohortRows('2026-09-28', 100, { 0: 100, 1: 50, 7: 25, 14: 12 }),
        ...cohortRows('2026-09-14', 10, { 0: 10, 1: 5 }),
      ),
    );
    const provider = createGa4Provider({ client });

    const result = await provider.getRetention(grind, {
      period: { from: '2026-09-07', to: '2026-10-04' },
      today: TODAY,
    });

    expect(result.cohorts.map((c) => c.cohortStart)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-28',
    ]);
    const [first, small, recent] = result.cohorts;
    expect(first?.retention.d1).toEqual({ state: 'ok', value: 0.4 });
    expect(first?.retention.d30).toEqual({ state: 'ok', value: 0.05 });
    expect(small?.retention.d1).toEqual({ state: 'not_enough_data' });
    expect(recent?.retention.d14).toEqual({ state: 'ok', value: 0.12 });
    expect(recent?.retention.d30).toEqual({ state: 'in_progress' });
    expect(result.summary.d1).toEqual({ state: 'ok', value: 0.45 });
  });

  it('asks for weekly install cohorts by first session date, twelve at most per report', async () => {
    const client = fakeGa4Client(() => report());
    const provider = createGa4Provider({ client });

    await provider.getRetention(grind, {
      period: { from: '2026-06-01', to: '2026-10-04' },
      today: TODAY,
    });

    expect(client.calls.length).toBeGreaterThan(1);
    for (const { request } of client.calls) {
      const spec = request.cohortSpec as { cohorts: { dimension: string }[] };
      expect(spec.cohorts.length).toBeLessThanOrEqual(12);
      expect(spec.cohorts.every((c) => c.dimension === 'firstSessionDate')).toBe(true);
    }
  });

  it('has no cohorts for an app without a property', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => report()) });

    const result = await provider.getRetention(unlinked, query);

    expect(result.cohorts).toEqual([]);
    expect(result.summary.d7.state).toBe('not_enough_data');
  });
});

describe('getAcquisition', () => {
  const sources = report(
    row(['instagram', 'social', 'Organic Social', 'grindquest_launch'], [30]),
    row(['tiktok', 'social', 'Organic Social', '(not set)'], [10]),
    row(['google-play', 'organic', 'Organic Search', '(not set)'], [100]),
    row(['(direct)', '(none)', 'Direct', '(direct)'], [20]),
  );

  it('groups new users into channels, with social broken out by source', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => sources) });

    const result = await provider.getAcquisition({ ...query, apps: [grind, puzzle] });

    if (result.data.state !== 'ok') throw new Error('expected data');
    // Two apps return the same rows, so each figure is doubled.
    expect(result.data.rows[0]).toEqual({
      channel: 'organic',
      source: null,
      users: 240,
      provenance: 'measured',
    });
    expect(result.data.rows.filter((r) => r.channel === 'social').map((r) => r.source)).toEqual([
      'instagram',
      'tiktok',
    ]);
    expect(result.data.measuredAttribution).toBe(true);
  });

  it('says no campaign details were reported when none came back', async () => {
    const client = fakeGa4Client(() =>
      report(row(['google-play', 'organic', 'Organic Search', '(not set)'], [100])),
    );

    const result = await createGa4Provider({ client }).getAcquisition({ ...query, apps: [grind] });

    if (result.data.state !== 'ok') throw new Error('expected data');
    expect(result.data.measuredAttribution).toBe(false);
  });

  it('asks GA4 for the first-user source, medium and campaign', async () => {
    const client = fakeGa4Client(() => report());

    await createGa4Provider({ client }).getAcquisition({ ...query, apps: [grind] });

    expect(hasDimension(client.calls[0]?.request ?? {}, 'firstUserCampaignName')).toBe(true);
  });
});

describe('getCampaignUsers', () => {
  const utm = {
    source: 'instagram',
    medium: 'social',
    campaign: 'grindquest_launch',
    content: 'reel_01',
  };

  it('filters on the link parameters and never reports more engaged than attributed', async () => {
    const client = fakeGa4Client((_id, request) =>
      request.cohortSpec ? report(row(['link', '0001'], [12])) : report(row([], [40, 55])),
    );

    const result = await createGa4Provider({ client }).getCampaignUsers(grind, utm, {
      period: { from: '2026-10-01', to: '2026-10-10' },
      today: TODAY,
    });

    expect(result.attributedUsers).toEqual({ state: 'ok', value: 40 });
    expect(result.engagedUsers).toEqual({ state: 'ok', value: 40 });
    expect(result.retainedUsers).toEqual({ state: 'ok', value: 12 });
    expect(JSON.stringify(client.calls[0]?.request.dimensionFilter)).toContain('reel_01');
  });

  it('shows retention as in progress until the day after the last arrival has passed', async () => {
    const client = fakeGa4Client(() => report(row([], [40, 30])));

    const result = await createGa4Provider({ client }).getCampaignUsers(grind, utm, {
      period: { from: '2026-10-15', to: '2026-10-21' },
      today: TODAY,
    });

    expect(result.retainedUsers).toEqual({ state: 'in_progress' });
  });

  it('says not enough data, not zero, when GA4 has no users for the link', async () => {
    const provider = createGa4Provider({ client: fakeGa4Client(() => report()) });

    const result = await provider.getCampaignUsers(grind, utm, query);

    expect(result.attributedUsers).toEqual({ state: 'not_enough_data' });
  });

  it('shows retention as not enough data when GA4 will not report it for a link', async () => {
    const client = fakeGa4Client((_id, request) => {
      if (request.cohortSpec) throw new Error('incompatible dimensions');
      return report(row([], [40, 30]));
    });

    const result = await createGa4Provider({ client }).getCampaignUsers(grind, utm, query);

    expect(result.attributedUsers).toEqual({ state: 'ok', value: 40 });
    expect(result.retainedUsers).toEqual({ state: 'not_enough_data' });
  });
});

describe('utmFilter', () => {
  it('leaves out the content when the link has none', () => {
    const filter = utmFilter({ source: 'a', medium: 'b', campaign: 'c' });

    expect(filter.andGroup.expressions).toHaveLength(3);
  });
});
