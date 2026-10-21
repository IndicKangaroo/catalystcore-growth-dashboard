import { ACQUISITION_CHANNELS, addDays, metricMissing, metricOk } from '@growth/shared';
import type {
  AcquisitionRow,
  AppRecord,
  AppUsers,
  Metric,
  MetricValue,
  RetentionCohort,
  SeriesPoint,
} from '@growth/shared';
import { logger } from '../../lib/logger';
import { poolCells, retentionCell, weeklyCohortStarts } from '../retention';
import type { AnalyticsProvider, PeriodQuery } from '../types';
import { channelOf, isReported } from './channels';
import type { DailyMetrics, Ga4Client, Ga4Report, SnapshotStore } from './types';

/**
 * The `ga4` provider: real numbers from the GA4 Data API (D-004). It answers the same shapes as the
 * demo provider, so the screens do not know which one they are reading, and every answer says
 * `source: 'ga4'`.
 *
 * A number GA4 cannot give is a state, never zero. An app without a property ID, or one that GA4
 * refuses to read, is named in `appsNotConnected` rather than left out of the totals unannounced.
 * Days are GA4's own days, which follow the property's time zone: set each property to the studio's
 * time zone so they line up with the dashboard's day buckets (D-014, D-046).
 */

const SOURCE = 'ga4' as const;

/** GA4 can revise a day's figures for a little while, so only older days are kept (D-048). */
const SETTLED_AFTER_DAYS = 3;
/** The Data API allows at most 12 cohorts in one report. */
const MAX_COHORTS_PER_REPORT = 12;
const COHORT_DAYS = 30;

const num = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const gaDate = (value: string): string =>
  `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;
const earlier = (a: string, b: string) => (a < b ? a : b);

const notEnough = (): MetricValue => metricMissing('not_enough_data');

export interface Ga4ProviderOptions {
  client: Ga4Client;
  snapshots?: SnapshotStore;
}

interface Totals {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  engagementSeconds: number;
}

export function createGa4Provider({ client, snapshots }: Ga4ProviderOptions): AnalyticsProvider {
  /** Reads one app, or says why it could not. Apps without a property are not even tried. */
  async function perApp<T>(
    apps: AppRecord[],
    read: (app: AppRecord, propertyId: string) => Promise<T>,
  ): Promise<{ done: { app: AppRecord; value: T }[]; notConnected: AppRecord[]; failure?: Error }> {
    const done: { app: AppRecord; value: T }[] = [];
    const notConnected: AppRecord[] = [];
    let failure: Error | undefined;
    await Promise.all(
      apps.map(async (app) => {
        if (!app.ga4PropertyId) {
          notConnected.push(app);
          return;
        }
        try {
          done.push({ app, value: await read(app, app.ga4PropertyId) });
        } catch (err) {
          notConnected.push(app);
          failure ??= err instanceof Error ? err : new Error(String(err));
          logger.warn('GA4 could not be read for an app', {
            appId: app.id,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );
    // Keep the order the apps were asked for in, whichever read finished first.
    const order = new Map(apps.map((app, index) => [app.id, index]));
    done.sort((a, b) => (order.get(a.app.id) ?? 0) - (order.get(b.app.id) ?? 0));
    notConnected.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { done, notConnected, failure };
  }

  async function totalsOf(propertyId: string, from: string, to: string): Promise<Totals | null> {
    const report = await client.runReport(propertyId, {
      dateRanges: [{ startDate: from, endDate: to }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'userEngagementDuration' },
      ],
    });
    const row = report.rows[0];
    if (!row) return null;
    const [active, fresh, sessions, seconds] = row.metrics.map(num);
    return {
      activeUsers: active ?? 0,
      newUsers: fresh ?? 0,
      sessions: sessions ?? 0,
      engagementSeconds: seconds ?? 0,
    };
  }

  async function fetchDaily(propertyId: string, from: string, to: string): Promise<DailyMetrics[]> {
    const report = await client.runReport(propertyId, {
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'userEngagementDuration' },
      ],
      limit: 10000,
    });
    return report.rows.map((row) => ({
      date: gaDate(row.dimensions[0] ?? ''),
      activeUsers: num(row.metrics[0]),
      newUsers: num(row.metrics[1]),
      sessions: num(row.metrics[2]),
      engagementSeconds: num(row.metrics[3]),
    }));
  }

  /** One app's days in a range: what was kept, plus a fresh read from the first day not kept. */
  async function dailyFor(
    app: AppRecord,
    propertyId: string,
    { period, today }: PeriodQuery,
  ): Promise<Map<string, DailyMetrics>> {
    const last = earlier(period.to, today);
    const days = new Map<string, DailyMetrics>();
    if (period.from > last) return days;

    if (snapshots) {
      try {
        for (const day of await snapshots.read(app.id, propertyId, period.from, last)) {
          days.set(day.date, day);
        }
      } catch (err) {
        logger.warn('Saved GA4 days could not be read; reading GA4 instead', {
          appId: app.id,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    let firstMissing: string | undefined;
    for (let date = period.from; date <= last; date = addDays(date, 1)) {
      if (!days.has(date)) {
        firstMissing = date;
        break;
      }
    }
    if (firstMissing === undefined) return days;

    const fetched = await fetchDaily(propertyId, firstMissing, last);
    const settled = fetched.filter((day) => day.date <= addDays(today, -SETTLED_AFTER_DAYS));
    if (snapshots && settled.length > 0) {
      try {
        await snapshots.write(app.id, propertyId, settled);
      } catch (err) {
        logger.warn('GA4 days could not be saved; the numbers are still shown', {
          appId: app.id,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
    for (const day of fetched) days.set(day.date, day);
    return days;
  }

  /** Weekly install cohorts for one app, with retention only where the window has ended. */
  async function cohortsFor(
    propertyId: string,
    { period, today }: PeriodQuery,
  ): Promise<RetentionCohort[]> {
    const starts = weeklyCohortStarts(period).filter((start) => start <= today);
    const found: RetentionCohort[] = [];
    for (let at = 0; at < starts.length; at += MAX_COHORTS_PER_REPORT) {
      const chunk = starts.slice(at, at + MAX_COHORTS_PER_REPORT);
      const report = await client.runReport(propertyId, {
        cohortSpec: {
          cohorts: chunk.map((start) => ({
            name: start,
            dimension: 'firstSessionDate',
            dateRange: { startDate: start, endDate: earlier(addDays(start, 6), today) },
          })),
          cohortsRange: { granularity: 'DAILY', startOffset: 0, endOffset: COHORT_DAYS },
        },
        dimensions: [{ name: 'cohort' }, { name: 'cohortNthDay' }],
        metrics: [{ name: 'cohortActiveUsers' }, { name: 'cohortTotalUsers' }],
        limit: 10000,
      });
      found.push(...cohortsOf(report, chunk, today));
    }
    return found;
  }

  return {
    name: SOURCE,

    async getOverview({ apps, period, today }) {
      const base = { source: SOURCE, range: period };
      const installs = metricMissing('not_connected');
      const revenue = metricMissing('not_connected');
      // Attribution is matched to registered campaigns (D-007), which arrive with the campaign
      // screens; until then there is nothing to match against, and it is not zero.
      const attributedUsers = metricMissing('no_measured_attribution');
      const nothing = (state: 'not_connected' | 'not_enough_data', unread: AppRecord[]) => {
        const none = metricMissing(state);
        return {
          ...base,
          appsWithData: 0,
          appsNotConnected: unread.map((app) => app.name),
          activeUsers: none,
          newUsers: none,
          sessions: none,
          installs,
          averageRetention: none,
          revenue,
          attributedUsers,
        };
      };

      const read = await perApp(apps, async (_app, propertyId) => ({
        totals: await totalsOf(propertyId, period.from, earlier(period.to, today)),
        cohorts: await cohortsFor(propertyId, { period, today }),
      }));
      const withData = read.done.filter((one) => one.value.totals !== null);
      if (withData.length === 0) {
        const connected = read.done.length > 0;
        return nothing(connected ? 'not_enough_data' : 'not_connected', read.notConnected);
      }

      const total = (pick: (totals: Totals) => number) =>
        withData.reduce((all, one) => all + pick(one.value.totals as Totals), 0);
      return {
        ...base,
        appsWithData: withData.length,
        appsNotConnected: read.notConnected.map((app) => app.name),
        activeUsers: metricOk(total((t) => t.activeUsers)),
        newUsers: metricOk(total((t) => t.newUsers)),
        sessions: metricOk(total((t) => t.sessions)),
        installs,
        averageRetention: poolCells(read.done.flatMap((one) => one.value.cohorts)).d7,
        revenue,
        attributedUsers,
      };
    },

    async getTimeSeries(query, metric: Metric) {
      const base = { source: SOURCE, metric, range: query.period };
      if (metric === 'attributed_users') {
        return { ...base, data: { state: 'no_measured_attribution' } };
      }
      const read = await perApp(query.apps, (app, propertyId) => dailyFor(app, propertyId, query));
      if (read.done.length === 0) {
        if (read.failure) throw read.failure;
        return { ...base, data: { state: 'not_connected' } };
      }

      const points: SeriesPoint[] = [];
      let anyData = false;
      for (let date = query.period.from; date <= query.period.to; date = addDays(date, 1)) {
        const days = read.done.flatMap((one) => one.value.get(date) ?? []);
        if (days.length === 0) {
          points.push({ date, value: null });
          continue;
        }
        anyData = true;
        points.push({ date, value: seriesValue(metric, days) });
      }
      return { ...base, data: anyData ? { state: 'ok', points } : { state: 'not_enough_data' } };
    },

    async getAppUsers(app, { period, today }): Promise<AppUsers> {
      const base = { source: SOURCE, appId: app.id, range: period };
      const none = (state: 'not_connected' | 'not_enough_data'): AppUsers => {
        const missing = metricMissing(state);
        return {
          ...base,
          dau: missing,
          wau: missing,
          mau: missing,
          newUsers: missing,
          returningUsers: missing,
          sessions: missing,
          sessionsPerUser: missing,
          averageEngagementSeconds: missing,
        };
      };
      if (!app.ga4PropertyId) return none('not_connected');
      const last = earlier(period.to, today);
      if (period.from > last) return none('not_enough_data');

      // DAU, WAU and MAU look back from the last day of the range (D-005).
      const [totals, windows] = await Promise.all([
        totalsOf(app.ga4PropertyId, period.from, last),
        client.runReport(app.ga4PropertyId, {
          dateRanges: [{ startDate: last, endDate: last }],
          metrics: [
            { name: 'active1DayUsers' },
            { name: 'active7DayUsers' },
            { name: 'active28DayUsers' },
          ],
        }),
      ]);
      if (!totals) return none('not_enough_data');

      const window = windows.rows[0];
      const lookBack = (index: number): MetricValue =>
        window ? metricOk(num(window.metrics[index])) : notEnough();
      const perUser = (total: number, digits: (value: number) => number): MetricValue =>
        totals.activeUsers > 0 ? metricOk(digits(total / totals.activeUsers)) : notEnough();
      return {
        ...base,
        dau: lookBack(0),
        wau: lookBack(1),
        mau: lookBack(2),
        newUsers: metricOk(totals.newUsers),
        returningUsers: metricOk(Math.max(0, totals.activeUsers - totals.newUsers)),
        sessions: metricOk(totals.sessions),
        sessionsPerUser: perUser(totals.sessions, round2),
        averageEngagementSeconds: perUser(totals.engagementSeconds, round1),
      };
    },

    async getRetention(app, query) {
      const base = { source: SOURCE, appId: app.id, range: query.period };
      const cohorts = app.ga4PropertyId ? await cohortsFor(app.ga4PropertyId, query) : [];
      return { ...base, summary: poolCells(cohorts), cohorts };
    },

    async getAcquisition(query) {
      const base = { source: SOURCE, range: query.period };
      const read = await perApp(query.apps, async (_app, propertyId) =>
        client.runReport(propertyId, {
          dateRanges: [
            { startDate: query.period.from, endDate: earlier(query.period.to, query.today) },
          ],
          dimensions: [
            { name: 'firstUserSource' },
            { name: 'firstUserMedium' },
            { name: 'firstUserDefaultChannelGroup' },
            { name: 'firstUserCampaignName' },
          ],
          metrics: [{ name: 'newUsers' }],
          limit: 10000,
        }),
      );
      if (read.done.length === 0) {
        if (read.failure) throw read.failure;
        return { ...base, data: { state: 'not_connected' } };
      }

      const rows = new Map<string, AcquisitionRow>();
      let measured = false;
      for (const { value: report } of read.done) {
        for (const row of report.rows) {
          const [source = '', medium = '', group = '', campaign = ''] = row.dimensions;
          const users = num(row.metrics[0]);
          if (users <= 0) continue;
          const where = channelOf({ source, medium, group });
          if (where.channel === 'social' && isReported(campaign)) measured = true;
          const key = `${where.channel}|${where.source ?? ''}`;
          const existing = rows.get(key);
          rows.set(
            key,
            existing
              ? { ...existing, users: existing.users + users }
              : { ...where, users, provenance: 'measured' },
          );
        }
      }
      if (rows.size === 0) return { ...base, data: { state: 'not_enough_data' } };

      const ordered = [...rows.values()].sort(
        (a, b) =>
          b.users - a.users ||
          ACQUISITION_CHANNELS.indexOf(a.channel) - ACQUISITION_CHANNELS.indexOf(b.channel) ||
          (a.source ?? '').localeCompare(b.source ?? ''),
      );
      return { ...base, data: { state: 'ok', rows: ordered, measuredAttribution: measured } };
    },

    async getCampaignUsers(app, utm, { period, today }) {
      const base = { source: SOURCE, range: period, utm, provenance: 'measured' as const };
      const none = (state: 'not_connected' | 'not_enough_data') => {
        const missing = metricMissing(state);
        return { ...base, attributedUsers: missing, engagedUsers: missing, retainedUsers: missing };
      };
      if (!app.ga4PropertyId) return none('not_connected');
      const last = earlier(period.to, today);
      if (period.from > last) return none('not_enough_data');

      const filter = utmFilter(utm);
      const report = await client.runReport(app.ga4PropertyId, {
        dateRanges: [{ startDate: period.from, endDate: last }],
        metrics: [{ name: 'newUsers' }, { name: 'activeUsers' }],
        dimensionFilter: filter,
      });
      const row = report.rows[0];
      if (!row) return none('not_enough_data');

      const attributed = num(row.metrics[0]);
      // People who arrived through the link and were active; never more than arrived (D-049).
      const engaged = Math.min(num(row.metrics[1]), attributed);
      return {
        ...base,
        attributedUsers: metricOk(attributed),
        engagedUsers: metricOk(engaged),
        retainedUsers: await retainedAfterOneDay(app.ga4PropertyId, period, today, filter),
      };
    },
  };

  /** People from the link who were active the day after they arrived, once that day has passed. */
  async function retainedAfterOneDay(
    propertyId: string,
    period: PeriodQuery['period'],
    today: string,
    filter: unknown,
  ): Promise<MetricValue> {
    if (addDays(period.to, 1) >= today) return metricMissing('in_progress');
    try {
      const report = await client.runReport(propertyId, {
        cohortSpec: {
          cohorts: [
            {
              name: 'link',
              dimension: 'firstSessionDate',
              dateRange: { startDate: period.from, endDate: period.to },
            },
          ],
          cohortsRange: { granularity: 'DAILY', startOffset: 0, endOffset: 1 },
        },
        dimensions: [{ name: 'cohort' }, { name: 'cohortNthDay' }],
        metrics: [{ name: 'cohortActiveUsers' }],
        dimensionFilter: filter,
      });
      const dayOne = report.rows.find((row) => Number(row.dimensions[1]) === 1);
      return dayOne ? metricOk(num(dayOne.metrics[0])) : notEnough();
    } catch (err) {
      // GA4 may not allow campaign dimensions in a cohort report; say so, do not show zero.
      logger.warn('GA4 could not report retention for a campaign link', {
        reason: err instanceof Error ? err.message : String(err),
      });
      return notEnough();
    }
  }
}

function seriesValue(metric: Metric, days: DailyMetrics[]): number {
  const sum = (pick: (day: DailyMetrics) => number) =>
    days.reduce((all, day) => all + pick(day), 0);
  switch (metric) {
    case 'active_users':
      return sum((day) => day.activeUsers);
    case 'new_users':
      return sum((day) => day.newUsers);
    case 'sessions':
      return sum((day) => day.sessions);
    case 'engagement_time': {
      const active = sum((day) => day.activeUsers);
      return active > 0 ? round1(sum((day) => day.engagementSeconds) / active) : 0;
    }
    case 'attributed_users':
      return 0;
  }
}

/** The campaign link's parameters as a GA4 filter on the user's first source (D-007). */
export function utmFilter(utm: {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}) {
  const exact = (fieldName: string, value: string) => ({
    filter: { fieldName, stringFilter: { matchType: 'EXACT', value, caseSensitive: false } },
  });
  return {
    andGroup: {
      expressions: [
        exact('firstUserSource', utm.source),
        exact('firstUserMedium', utm.medium),
        exact('firstUserCampaignName', utm.campaign),
        ...(utm.content ? [exact('firstUserManualAdContent', utm.content)] : []),
      ],
    },
  };
}

/** Turns a cohort report into the weekly cohorts, one per Monday asked for. */
export function cohortsOf(report: Ga4Report, starts: string[], today: string): RetentionCohort[] {
  const byCohort = new Map<string, { total: number; active: Map<number, number> }>();
  for (const row of report.rows) {
    const [name = '', nth = ''] = row.dimensions;
    const entry = byCohort.get(name) ?? { total: 0, active: new Map<number, number>() };
    entry.total = Math.max(entry.total, num(row.metrics[1]));
    entry.active.set(Number(nth), num(row.metrics[0]));
    byCohort.set(name, entry);
  }

  const cohorts: RetentionCohort[] = [];
  for (const cohortStart of starts) {
    const entry = byCohort.get(cohortStart);
    if (!entry || entry.total === 0) continue;
    const cohortEnd = addDays(cohortStart, 6);
    const users = entry.total;
    const cell = (day: number) =>
      retentionCell({
        cohortEnd,
        day,
        today,
        users,
        fraction: (entry.active.get(day) ?? 0) / users,
      });
    cohorts.push({
      cohortStart,
      cohortEnd,
      users,
      retention: { d1: cell(1), d7: cell(7), d14: cell(14), d30: cell(30) },
    });
  }
  return cohorts;
}
