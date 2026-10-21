import type { AnalyticsProviderName } from '@growth/shared';
import type { Config } from '../lib/config';
import { createGa4Client } from './ga4/client';
import { createGa4Provider } from './ga4';
import type { SnapshotStore } from './ga4/types';
import { createSeedProvider } from './seed';
import type { AnalyticsProvider } from './types';

export type { AnalyticsProvider, PeriodQuery, ProviderQuery } from './types';
export { createSeedProvider } from './seed';

/** The provider the environment names (ANALYTICS_PROVIDER). */
export function createProvider(
  name: AnalyticsProviderName,
  options: {
    config?: Pick<Config, 'GA4_SERVICE_ACCOUNT_KEY_FILE'>;
    snapshots?: SnapshotStore;
  } = {},
): AnalyticsProvider {
  switch (name) {
    case 'seed':
      return createSeedProvider();
    case 'ga4':
      return createGa4Provider({
        client: createGa4Client({ keyFile: options.config?.GA4_SERVICE_ACCOUNT_KEY_FILE }),
        snapshots: options.snapshots,
      });
  }
}
