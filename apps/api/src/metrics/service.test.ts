import { analyticsQuerySchema } from '@growth/shared';
import type { AppRecord } from '@growth/shared';
import { describe, expect, it } from 'vitest';
import { createAppService } from '../apps/service';
import { AppError } from '../middleware/errors';
import { createSeedProvider } from '../providers';
import type { AnalyticsProvider, PeriodQuery, ProviderQuery } from '../providers';
import { createStudioSettingsService } from '../settings/service';
import { makeApp } from '../testing/apps';
import { createMemoryAppRepository } from '../testing/memoryAppRepository';
import { createMemorySettingsRepository } from '../testing/memorySettingsRepository';
import { createMetricsService } from './service';

// 20:00 UTC on the 17th is already the 18th in India and still the 17th in Hawaii.
const NOW = new Date('2026-10-17T20:00:00.000Z');

const alpha = makeApp({ id: 'alpha', name: 'Alpha' });
const beta = makeApp({ id: 'beta', name: 'Beta' });

/** The demo provider, and a note of what it was asked, so a test can see what the service passed on. */
function recordingProvider() {
  const seed = createSeedProvider();
  const calls: { read: string; apps: string[]; query: PeriodQuery }[] = [];
  const note = (read: string, apps: AppRecord[], query: PeriodQuery) =>
    calls.push({ read, apps: apps.map((app) => app.id), query: { ...query } });

  const provider: AnalyticsProvider = {
    ...seed,
    name: 'seed',
    async getOverview(query: ProviderQuery) {
      note('overview', query.apps, query);
      return seed.getOverview(query);
    },
    async getTimeSeries(query, metric) {
      note('series', query.apps, query);
      return seed.getTimeSeries(query, metric);
    },
    async getAppUsers(app, query) {
      note('users', [app], query);
      return seed.getAppUsers(app, query);
    },
    async getRetention(app, query) {
      note('retention', [app], query);
      return seed.getRetention(app, query);
    },
  };
  return { provider, calls };
}

function setup(studio: Record<string, unknown> | null = null, apps = [beta, alpha]) {
  const { provider, calls } = recordingProvider();
  const service = createMetricsService({
    apps: createAppService({ repo: createMemoryAppRepository(apps) }),
    studio: createStudioSettingsService(createMemorySettingsRepository(studio)),
    provider,
    now: () => NOW,
  });
  return { service, calls };
}

const query = (fields: Record<string, string> = {}) =>
  analyticsQuerySchema.parse({ from: '2026-10-01', to: '2026-10-17', ...fields });

async function failure(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('Expected the call to fail');
}

describe('overview', () => {
  it('asks about every app when none is chosen, in name order', async () => {
    const { service, calls } = setup();

    const overview = await service.overview(query());

    expect(overview.source).toBe('seed');
    expect(overview.range).toEqual({ from: '2026-10-01', to: '2026-10-17' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.apps).toEqual(['alpha', 'beta']);
  });

  it('asks only about the apps that were chosen', async () => {
    const { service, calls } = setup();

    await service.overview(query({ appIds: 'beta' }));

    expect(calls[0]?.apps).toEqual(['beta']);
  });

  it('refuses an app that does not exist instead of leaving it out', async () => {
    const { service, calls } = setup();

    const error = await failure(service.overview(query({ appIds: 'alpha,ghost' })));

    expect(error.status).toBe(404);
    expect(error.code).toBe('app_not_found');
    expect(error.message).toContain('ghost');
    expect(calls).toEqual([]);
  });

  it('says "not connected" for a studio with no apps, never zero', async () => {
    const { service } = setup(null, []);

    const overview = await service.overview(query());

    expect(overview.activeUsers).toEqual({ state: 'not_connected' });
    expect(overview.newUsers).toEqual({ state: 'not_connected' });
  });
});

describe("today, in the studio's time zone", () => {
  it('uses Asia/Kolkata when the studio has not been set up', async () => {
    const { service, calls } = setup(null);

    await service.overview(query());

    expect(calls[0]?.query.today).toBe('2026-10-18');
  });

  it("follows the studio's own time zone", async () => {
    const { service, calls } = setup({ timezone: 'Pacific/Honolulu' });

    await service.overview(query());

    expect(calls[0]?.query.today).toBe('2026-10-17');
  });

  it('passes the range on as it was asked', async () => {
    const { service, calls } = setup();

    await service.series(query({ from: '2026-09-01', to: '2026-09-30' }), 'sessions');

    expect(calls[0]?.query.period).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('series', () => {
  it('answers for the metric asked', async () => {
    const { service, calls } = setup();

    const series = await service.series(query({ appIds: 'alpha' }), 'new_users');

    expect(series.metric).toBe('new_users');
    expect(series.source).toBe('seed');
    expect(calls[0]).toMatchObject({ read: 'series', apps: ['alpha'] });
  });
});

describe('one app', () => {
  it('reads the users of the app named in the address', async () => {
    const { service, calls } = setup();

    const users = await service.appUsers('beta', query());

    expect(users.appId).toBe('beta');
    expect(calls[0]).toMatchObject({ read: 'users', apps: ['beta'] });
  });

  it('reads the retention of the app named in the address', async () => {
    const { service, calls } = setup();

    const retention = await service.retention('alpha', query());

    expect(retention.appId).toBe('alpha');
    expect(calls[0]).toMatchObject({ read: 'retention', apps: ['alpha'] });
  });

  it('says there is no such app, and asks the provider nothing', async () => {
    const { service, calls } = setup();

    const users = await failure(service.appUsers('ghost', query()));
    const retention = await failure(service.retention('ghost', query()));

    expect(users.code).toBe('app_not_found');
    expect(retention.code).toBe('app_not_found');
    expect(calls).toEqual([]);
  });
});

describe('a studio whose settings are broken', () => {
  it('answers with the setup problem instead of guessing a time zone', async () => {
    const { service } = setup({ timezone: 'Not/AZone' });

    const error = await failure(service.overview(query()));

    expect(error.status).toBe(503);
    expect(error.code).toBe('studio_settings_invalid');
  });
});
