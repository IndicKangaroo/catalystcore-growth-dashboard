import { todayIn } from '@growth/shared';
import type {
  AnalyticsQuery,
  AppRecord,
  AppUsers,
  Metric,
  Overview,
  Retention,
  Series,
} from '@growth/shared';
import type { AppService } from '../apps/service';
import { AppError } from '../middleware/errors';
import type { AnalyticsProvider, PeriodQuery } from '../providers/types';
import type { StudioSettingsService } from '../settings/service';

export interface MetricsServiceOptions {
  apps: AppService;
  studio: StudioSettingsService;
  provider: AnalyticsProvider;
  now?: () => Date;
}

/**
 * The reads behind the Overview and App detail screens (PLAN section 7). It looks the apps up and
 * works out what day it is where the studio is, then asks the provider; it never computes numbers
 * itself, so a real provider can replace the demo one without any change here (D-033).
 *
 * The platform, campaign and content-type filters are not about apps and days (D-033), so they are
 * accepted by the routes and left for the services that own posts and campaigns (P5 onwards).
 */
export interface MetricsService {
  overview(query: AnalyticsQuery): Promise<Overview>;
  series(query: AnalyticsQuery, metric: Metric): Promise<Series>;
  appUsers(appId: string, query: AnalyticsQuery): Promise<AppUsers>;
  retention(appId: string, query: AnalyticsQuery): Promise<Retention>;
}

export function createMetricsService(options: MetricsServiceOptions): MetricsService {
  const { apps, studio, provider } = options;
  const now = options.now ?? (() => new Date());

  /** The days asked for, and today in the studio's time zone (D-014). */
  async function periodOf(query: AnalyticsQuery): Promise<PeriodQuery> {
    const { settings } = await studio.get();
    return {
      period: { from: query.from, to: query.to },
      today: todayIn(settings.timezone, now()),
    };
  }

  /**
   * The apps a read is about. An empty list means every app. An id that names no app is an error,
   * not something to skip: quietly leaving it out would show totals for other apps than the ones
   * the person chose.
   */
  async function appsFor(appIds: string[]): Promise<AppRecord[]> {
    const all = await apps.list();
    if (appIds.length === 0) return all;

    const byId = new Map(all.map((app) => [app.id, app]));
    const missing = appIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new AppError(404, 'app_not_found', `No such app: ${missing.join(', ')}`);
    }
    return appIds.flatMap((id) => byId.get(id) ?? []);
  }

  return {
    async overview(query) {
      const period = await periodOf(query);
      return provider.getOverview({ ...period, apps: await appsFor(query.appIds) });
    },

    async series(query, metric) {
      const period = await periodOf(query);
      return provider.getTimeSeries({ ...period, apps: await appsFor(query.appIds) }, metric);
    },

    async appUsers(appId, query) {
      const app = await apps.get(appId);
      return provider.getAppUsers(app, await periodOf(query));
    },

    async retention(appId, query) {
      const app = await apps.get(appId);
      return provider.getRetention(app, await periodOf(query));
    },
  };
}
