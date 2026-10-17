import type { AppRepository } from './apps/types';
import type { TokenVerifier } from './auth/types';
import type { AnalyticsProvider } from './providers/types';
import type { SettingsRepository } from './settings/types';
import type { UserRepository } from './users/types';

/** Everything the API needs from the outside world. Tests pass fakes; production passes Firebase. */
export interface AppDeps {
  verifier: TokenVerifier;
  users: UserRepository;
  apps: AppRepository;
  settings: SettingsRepository;
  provider: AnalyticsProvider;
}

/**
 * What Firebase supplies. The analytics provider is chosen by configuration (ANALYTICS_PROVIDER),
 * not by the database, so it is added separately.
 */
export type FirebaseDeps = Omit<AppDeps, 'provider'>;
