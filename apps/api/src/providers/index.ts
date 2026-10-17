import type { AnalyticsProviderName } from '@growth/shared';
import { ConfigError } from '../lib/config';
import { createSeedProvider } from './seed';
import type { AnalyticsProvider } from './types';

export type { AnalyticsProvider, PeriodQuery, ProviderQuery } from './types';
export { createSeedProvider } from './seed';

/** The provider the environment names (ANALYTICS_PROVIDER). */
export function createProvider(name: AnalyticsProviderName): AnalyticsProvider {
  switch (name) {
    case 'seed':
      return createSeedProvider();
    case 'ga4':
      // Stopping at start-up is kinder than answering every request with demo data that the
      // person believes is real.
      throw new ConfigError(
        'ANALYTICS_PROVIDER=ga4 is not available yet: the GA4 provider arrives in phase P4. ' +
          'Set ANALYTICS_PROVIDER=seed to use the labelled demo data until then.',
      );
  }
}
