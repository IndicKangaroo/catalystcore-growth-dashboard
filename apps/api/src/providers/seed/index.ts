import { ACQUISITION_CHANNELS, addDays, metricMissing, metricOk } from '@growth/shared';
import type {
  AcquisitionRow,
  AppRecord,
  DateRange,
  Metric,
  MetricValue,
  RetentionCohort,
  SeriesPoint,
} from '@growth/shared';
import { poolCells, retentionCell, weeklyCohortStarts } from '../retention';
import type { AnalyticsProvider } from '../types';
import { allocate } from './allocate';
import { between } from './random';
import {
  OTHER_CHANNELS,
  SOCIAL_SOURCES,
  dayValues,
  profileFor,
  retentionFractions,
  totalsOf,
  valuesBetween,
} from './model';
import type { DayValues, Totals } from './model';

/**
 * The `seed` provider: deterministic made-up data, so the dashboard can be tried, tested and
 * demonstrated before any real property is connected (D-036). It answers for every app it is
 * given, and every answer says `source: 'seed'`, which is how the screens know to label it
 * "Demo data". It is the only place sample figures may live (AGENTS.md).
 */

const SOURCE = 'seed' as const;

const ok = metricOk;
const notEnoughData = (): MetricValue => metricMissing('not_enough_data');

const sum = (days: DayValues[], pick: (day: DayValues) => number) =>
  days.reduce((all, day) => all + pick(day), 0);

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** One day's figure for one metric, across the apps that have figures for that day. */
function seriesValue(metric: Metric, days: DayValues[]): number {
  switch (metric) {
    case 'active_users':
      return sum(days, (day) => day.active);
    case 'new_users':
      return sum(days, (day) => day.newUsers);
    case 'sessions':
      return sum(days, (day) => day.sessions);
    case 'attributed_users':
      return sum(days, (day) => day.attributedUsers);
    case 'engagement_time':
      return round1(
        sum(days, (day) => day.active * day.engagementSeconds) / sum(days, (day) => day.active),
      );
  }
}

function totalsFor(app: AppRecord, range: DateRange, today: string): Totals | null {
  return totalsOf(valuesBetween(app, range.from, range.to, today));
}

/** The app's weekly install cohorts that overlap the range, oldest first. */
function cohortsFor(app: AppRecord, range: DateRange, today: string): RetentionCohort[] {
  const cohorts: RetentionCohort[] = [];
  for (const cohortStart of weeklyCohortStarts(range)) {
    const cohortEnd = addDays(cohortStart, 6);
    const users = totalsOf(valuesBetween(app, cohortStart, cohortEnd, today))?.newUsers ?? 0;
    if (users === 0) continue;

    const fractions = retentionFractions(app, cohortStart);
    const cell = (day: number, fraction: number) =>
      retentionCell({ cohortEnd, day, today, users, fraction });
    cohorts.push({
      cohortStart,
      cohortEnd,
      users,
      retention: {
        d1: cell(1, fractions.d1),
        d7: cell(7, fractions.d7),
        d14: cell(14, fractions.d14),
        d30: cell(30, fractions.d30),
      },
    });
  }
  return cohorts;
}

/**
 * How one app's new users in a range arrived. The users matched to a campaign are split across
 * the social platforms, and the rest across the other channels, so the rows add up to exactly the
 * app's new users and the social rows to exactly its attributed users.
 */
function acquisitionRowsFor(app: AppRecord, totals: Totals): AcquisitionRow[] {
  const profile = profileFor(app);
  const social = allocate(totals.attributedUsers, profile.socialWeights);
  const rest = allocate(totals.newUsers - totals.attributedUsers, profile.mixWeights);
  return [
    ...SOCIAL_SOURCES.map((source, index) => ({
      channel: 'social' as const,
      source,
      users: social[index] ?? 0,
      provenance: 'measured' as const,
    })),
    ...OTHER_CHANNELS.map((channel, index) => ({
      channel,
      source: null,
      users: rest[index] ?? 0,
      provenance: 'measured' as const,
    })),
  ];
}

/** Most users first; equal rows keep the order of the channels, then of the source names. */
function compareRows(a: AcquisitionRow, b: AcquisitionRow): number {
  return (
    b.users - a.users ||
    ACQUISITION_CHANNELS.indexOf(a.channel) - ACQUISITION_CHANNELS.indexOf(b.channel) ||
    (a.source ?? '').localeCompare(b.source ?? '')
  );
}

export function createSeedProvider(): AnalyticsProvider {
  return {
    name: SOURCE,

    async getOverview({ apps, period, today }) {
      const base = { source: SOURCE, range: period, appsNotConnected: [] };
      // Revenue and installs need a store or ad integration that does not exist yet (D-013), so
      // even the demo does not invent them.
      const installs = metricMissing('not_connected');
      const revenue = metricMissing('not_connected');

      if (apps.length === 0) {
        const none = metricMissing('not_connected');
        return {
          ...base,
          appsWithData: 0,
          activeUsers: none,
          newUsers: none,
          sessions: none,
          installs,
          averageRetention: none,
          revenue,
          attributedUsers: none,
        };
      }

      const totals = apps.flatMap((app) => totalsFor(app, period, today) ?? []);
      if (totals.length === 0) {
        const none = notEnoughData();
        return {
          ...base,
          appsWithData: 0,
          activeUsers: none,
          newUsers: none,
          sessions: none,
          installs,
          averageRetention: none,
          revenue,
          attributedUsers: none,
        };
      }

      const total = (pick: (totals: Totals) => number) =>
        totals.reduce((all, one) => all + pick(one), 0);
      const cohorts = apps.flatMap((app) => cohortsFor(app, period, today));
      return {
        ...base,
        appsWithData: totals.length,
        activeUsers: ok(total((one) => one.activeUsers)),
        newUsers: ok(total((one) => one.newUsers)),
        sessions: ok(total((one) => one.sessions)),
        installs,
        averageRetention: poolCells(cohorts).d7,
        revenue,
        attributedUsers: ok(total((one) => one.attributedUsers)),
      };
    },

    async getTimeSeries({ apps, period, today }, metric) {
      const base = { source: SOURCE, metric, range: period };
      if (apps.length === 0) return { ...base, data: { state: 'not_connected' } };

      const points: SeriesPoint[] = [];
      let anyData = false;
      for (let date = period.from; date <= period.to; date = addDays(date, 1)) {
        const days = apps.flatMap((app) => dayValues(app, date, today) ?? []);
        if (days.length === 0) {
          points.push({ date, value: null });
        } else {
          anyData = true;
          points.push({ date, value: seriesValue(metric, days) });
        }
      }
      return { ...base, data: anyData ? { state: 'ok', points } : { state: 'not_enough_data' } };
    },

    async getAppUsers(app, { period, today }) {
      const base = { source: SOURCE, appId: app.id, range: period };
      const lastDay = period.to < today ? period.to : today;
      const range = totalsOf(valuesBetween(app, period.from, lastDay, today));

      if (!range) {
        const none = notEnoughData();
        return {
          ...base,
          dau: none,
          wau: none,
          mau: none,
          newUsers: none,
          returningUsers: none,
          sessions: none,
          sessionsPerUser: none,
          averageEngagementSeconds: none,
        };
      }

      // DAU, WAU and MAU look back from the last day of the range (D-005).
      const lookBack = (days: number): MetricValue => {
        const window = totalsOf(valuesBetween(app, addDays(lastDay, 1 - days), lastDay, today));
        return window ? ok(window.activeUsers) : notEnoughData();
      };
      return {
        ...base,
        dau: lookBack(1),
        wau: lookBack(7),
        mau: lookBack(28),
        newUsers: ok(range.newUsers),
        returningUsers: ok(range.activeUsers - range.newUsers),
        sessions: ok(range.sessions),
        sessionsPerUser: ok(round2(range.sessions / range.activeUsers)),
        averageEngagementSeconds: ok(range.engagementSeconds),
      };
    },

    async getRetention(app, { period, today }) {
      const cohorts = cohortsFor(app, period, today);
      return {
        source: SOURCE,
        appId: app.id,
        range: period,
        summary: poolCells(cohorts),
        cohorts,
      };
    },

    async getAcquisition({ apps, period, today }) {
      const base = { source: SOURCE, range: period };
      if (apps.length === 0) return { ...base, data: { state: 'not_connected' } };

      const rows = new Map<string, AcquisitionRow>();
      let appsWithData = 0;
      let attributedUsers = 0;
      for (const app of apps) {
        const totals = totalsFor(app, period, today);
        if (!totals) continue;
        appsWithData += 1;
        attributedUsers += totals.attributedUsers;
        for (const row of acquisitionRowsFor(app, totals)) {
          const key = `${row.channel}|${row.source ?? ''}`;
          const existing = rows.get(key);
          rows.set(key, existing ? { ...existing, users: existing.users + row.users } : row);
        }
      }
      if (appsWithData === 0) return { ...base, data: { state: 'not_enough_data' } };

      return {
        ...base,
        data: {
          state: 'ok',
          rows: [...rows.values()].filter((row) => row.users > 0).sort(compareRows),
          measuredAttribution: attributedUsers > 0,
        },
      };
    },

    async getCampaignUsers(app, utm, { period, today }) {
      const base = { source: SOURCE, range: period, utm, provenance: 'measured' as const };
      const totals = totalsFor(app, period, today);
      if (!totals) {
        const none = notEnoughData();
        return { ...base, attributedUsers: none, engagedUsers: none, retainedUsers: none };
      }

      const key = (field: string) =>
        `${app.id}|campaign|${utm.source}|${utm.medium}|${utm.campaign}|${utm.content ?? ''}|${field}`;
      const attributed = Math.round(totals.newUsers * between(key('share'), 0.01, 0.08));
      const engaged = Math.round(attributed * between(key('engaged'), 0.45, 0.8));
      const retained = Math.round(engaged * between(key('retained'), 0.25, 0.5));
      return {
        ...base,
        attributedUsers: ok(attributed),
        engagedUsers: ok(engaged),
        retainedUsers: ok(retained),
      };
    },
  };
}
