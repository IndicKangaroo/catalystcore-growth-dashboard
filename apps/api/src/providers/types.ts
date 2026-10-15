import type {
  Acquisition,
  AnalyticsProviderName,
  AppRecord,
  AppUsers,
  CampaignOutcome,
  DateRange,
  Metric,
  Overview,
  Retention,
  Series,
  UtmKey,
} from '@growth/shared';

/**
 * The days a read covers, and what day it is now where the studio is (D-014). A day after `today`
 * has no data yet, and a window that has not ended by `today` is `in_progress`, never a number.
 */
export interface PeriodQuery {
  period: DateRange;
  today: string;
}

/**
 * A read over several apps. The caller has already looked the apps up, so a provider never touches
 * the database: it gets the property IDs and launch dates it needs from the records.
 */
export interface ProviderQuery extends PeriodQuery {
  apps: AppRecord[];
}

/**
 * Where analytics numbers come from (PLAN section 6, D-033). Routes and services call this and
 * nothing else; they never import the GA4 client. Every answer carries `source`, and a number that
 * cannot be given is a state with a reason (AGENTS.md), never zero.
 *
 * Filters that are not about apps and days (platform, campaign, content type) are applied by the
 * services that own posts and campaigns, not by a provider.
 */
export interface AnalyticsProvider {
  readonly name: AnalyticsProviderName;
  getOverview(query: ProviderQuery): Promise<Overview>;
  getTimeSeries(query: ProviderQuery, metric: Metric): Promise<Series>;
  getAppUsers(app: AppRecord, query: PeriodQuery): Promise<AppUsers>;
  getRetention(app: AppRecord, query: PeriodQuery): Promise<Retention>;
  getAcquisition(query: ProviderQuery): Promise<Acquisition>;
  getCampaignUsers(app: AppRecord, utm: UtmKey, query: PeriodQuery): Promise<CampaignOutcome>;
}
