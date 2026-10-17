import { z } from 'zod';
import { dateRangeSchema } from './dateRange';
import { calendarDateSchema } from './dates';
import {
  acquisitionChannelSchema,
  analyticsProviderSchema,
  metricSchema,
  provenanceSchema,
} from './enums';
import type { MetricState } from './enums';

/**
 * What an analytics provider answers (PLAN section 6, D-033). The `seed` provider and the `ga4`
 * provider return exactly these shapes, so the screens never know which one is behind them.
 *
 * Two rules shape every type here. A number that is missing is a state with a reason, never zero
 * (AGENTS.md), so each number is a `MetricValue`. And every answer says which provider made it
 * (`source`), so a screen can label demo data from the answer itself.
 */

/** One number that may be missing. `ok` carries the value; any other state says why there is none. */
export const metricValueSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('ok'), value: z.number() }),
  z.object({ state: z.literal('not_connected') }),
  z.object({ state: z.literal('no_measured_attribution') }),
  z.object({ state: z.literal('not_enough_data') }),
  z.object({ state: z.literal('in_progress') }),
]);
export type MetricValue = z.infer<typeof metricValueSchema>;

export type MissingState = Exclude<MetricState, 'ok'>;

export function metricOk(value: number): MetricValue {
  return { state: 'ok', value };
}

export function metricMissing(state: MissingState): MetricValue {
  return { state } as MetricValue;
}

const countSchema = z.number().int().nonnegative();

/** Totals over the range for the apps asked about (PRD section 4). */
export const overviewSchema = z.object({
  source: analyticsProviderSchema,
  range: dateRangeSchema,
  /** How many of the apps asked about the numbers cover. */
  appsWithData: countSchema,
  /** The apps that could not be read, so a total never silently leaves one out. */
  appsNotConnected: z.array(z.string()),
  /** Users summed across apps: a person who uses two apps counts twice. */
  activeUsers: metricValueSchema,
  newUsers: metricValueSchema,
  sessions: metricValueSchema,
  /** Needs a store integration to be reliable (V2), so providers report `not_connected`. */
  installs: metricValueSchema,
  /** Day-7 retention as a fraction, from install cohorts whose seventh day has passed. */
  averageRetention: metricValueSchema,
  /** Needs AdMob or Play Billing (D-013), so providers report `not_connected`. */
  revenue: metricValueSchema,
  /** New users matched to a registered campaign: measured attribution only (D-002). */
  attributedUsers: metricValueSchema,
});
export type Overview = z.infer<typeof overviewSchema>;

/** A day's value. `null` is a day without data, which is not the same as zero. */
export const seriesPointSchema = z.object({
  date: calendarDateSchema,
  value: z.number().nullable(),
});
export type SeriesPoint = z.infer<typeof seriesPointSchema>;

export const seriesDataSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('ok'), points: z.array(seriesPointSchema) }),
  z.object({ state: z.literal('not_connected') }),
  z.object({ state: z.literal('no_measured_attribution') }),
  z.object({ state: z.literal('not_enough_data') }),
]);
export type SeriesData = z.infer<typeof seriesDataSchema>;

/** One metric over time, one point per day in the range, summed or averaged across the apps. */
export const seriesSchema = z.object({
  source: analyticsProviderSchema,
  metric: metricSchema,
  range: dateRangeSchema,
  data: seriesDataSchema,
});
export type Series = z.infer<typeof seriesSchema>;

/**
 * One app's users (PRD section 6). DAU, WAU and MAU are the active users on the last day of the
 * range, over 1, 7 and 28 days (D-005); the rest cover the whole range.
 */
export const appUsersSchema = z.object({
  source: analyticsProviderSchema,
  appId: z.string(),
  range: dateRangeSchema,
  dau: metricValueSchema,
  wau: metricValueSchema,
  mau: metricValueSchema,
  newUsers: metricValueSchema,
  returningUsers: metricValueSchema,
  sessions: metricValueSchema,
  sessionsPerUser: metricValueSchema,
  averageEngagementSeconds: metricValueSchema,
});
export type AppUsers = z.infer<typeof appUsersSchema>;

export const RETENTION_DAYS = [1, 7, 14, 30] as const;

/** Retention on days 1, 7, 14 and 30 as fractions. A window that has not ended is `in_progress`. */
export const retentionCellsSchema = z.object({
  d1: metricValueSchema,
  d7: metricValueSchema,
  d14: metricValueSchema,
  d30: metricValueSchema,
});
export type RetentionCells = z.infer<typeof retentionCellsSchema>;

export const retentionCohortSchema = z.object({
  /** Weekly install cohorts run Monday to Sunday (D-006, D-014). */
  cohortStart: calendarDateSchema,
  cohortEnd: calendarDateSchema,
  users: countSchema,
  retention: retentionCellsSchema,
});
export type RetentionCohort = z.infer<typeof retentionCohortSchema>;

export const retentionSchema = z.object({
  source: analyticsProviderSchema,
  appId: z.string(),
  range: dateRangeSchema,
  /** Across the cohorts in the range, weighted by cohort size. */
  summary: retentionCellsSchema,
  cohorts: z.array(retentionCohortSchema),
});
export type Retention = z.infer<typeof retentionSchema>;

/** New users by where they came from. Every row says how its number was obtained (D-002). */
export const acquisitionRowSchema = z.object({
  channel: acquisitionChannelSchema,
  /** A named source inside the channel, such as "instagram" in Social, or null for the whole channel. */
  source: z.string().nullable(),
  users: countSchema,
  provenance: provenanceSchema,
});
export type AcquisitionRow = z.infer<typeof acquisitionRowSchema>;

export const acquisitionDataSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('ok'),
    rows: z.array(acquisitionRowSchema),
    /** False when no campaign details were reported, so the table has no measured social rows. */
    measuredAttribution: z.boolean(),
  }),
  z.object({ state: z.literal('not_connected') }),
  z.object({ state: z.literal('not_enough_data') }),
]);
export type AcquisitionData = z.infer<typeof acquisitionDataSchema>;

export const acquisitionSchema = z.object({
  source: analyticsProviderSchema,
  range: dateRangeSchema,
  data: acquisitionDataSchema,
});
export type Acquisition = z.infer<typeof acquisitionSchema>;

/** The tracking parameters of a campaign link (D-008). */
export const utmKeySchema = z.object({
  source: z.string().min(1),
  medium: z.string().min(1),
  campaign: z.string().min(1),
  content: z.string().min(1).optional(),
});
export type UtmKey = z.infer<typeof utmKeySchema>;

/**
 * What followed from one campaign link: users matched to its parameters, how many of them
 * engaged, how many came back. A provider only reports what it measured, so provenance is always
 * `measured` here; inferred and manual figures come from other services.
 */
export const campaignOutcomeSchema = z.object({
  source: analyticsProviderSchema,
  range: dateRangeSchema,
  utm: utmKeySchema,
  provenance: z.literal('measured'),
  attributedUsers: metricValueSchema,
  engagedUsers: metricValueSchema,
  retainedUsers: metricValueSchema,
});
export type CampaignOutcome = z.infer<typeof campaignOutcomeSchema>;
