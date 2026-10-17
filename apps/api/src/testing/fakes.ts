import type { AppRecord, UserRecord } from '@growth/shared';
import { createApp } from '../app';
import type { TokenVerifier, VerifiedToken } from '../auth/types';
import type { AppDeps } from '../deps';
import { loadConfig } from '../lib/config';
import { createSeedProvider } from '../providers';
import type { AnalyticsProvider } from '../providers';
import { createMemoryAppRepository } from './memoryAppRepository';
import { createMemorySettingsRepository } from './memorySettingsRepository';
import { createMemoryUserRepository } from './memoryUserRepository';
import { FIXED_TIME } from './time';

export { FIXED_TIME };

/** A complete user record with sensible defaults. By default the person has already signed in. */
export function makeUser(overrides: Partial<UserRecord> & Pick<UserRecord, 'email'>): UserRecord {
  return {
    name: null,
    role: 'growth',
    active: true,
    uid: `uid-${overrides.email}`,
    createdAt: FIXED_TIME,
    createdBy: null,
    updatedAt: FIXED_TIME,
    lastLoginAt: null,
    ...overrides,
  };
}

/** The result of verifying a Firebase token for this email. */
export function makeToken(email: string, overrides: Partial<VerifiedToken> = {}): VerifiedToken {
  return { uid: `uid-${email}`, email, emailVerified: true, name: undefined, ...overrides };
}

/** Accepts only the tokens it was given, like a verifier that knows a fixed set of sessions. */
export function createFakeVerifier(tokens: Record<string, VerifiedToken>): TokenVerifier {
  return {
    async verify(idToken) {
      const token = tokens[idToken];
      if (!token) {
        throw new Error('unknown test token');
      }
      return token;
    },
  };
}

/**
 * Dependencies for a test: in-memory stores and the demo-data provider, unless the test passes its
 * own. A test names only the parts it cares about.
 */
export function fakeDeps(parts: Pick<AppDeps, 'verifier' | 'users'> & Partial<AppDeps>): AppDeps {
  return {
    apps: createMemoryAppRepository(),
    settings: createMemorySettingsRepository(),
    provider: createSeedProvider(),
    ...parts,
  };
}

export interface TestAppOptions {
  users?: UserRecord[];
  apps?: AppRecord[];
  /** The `settings/studio` document. Leave it out for a studio that has not set it up yet. */
  studio?: Record<string, unknown>;
  tokens?: Record<string, VerifiedToken>;
  adminEmail?: string;
  provider?: AnalyticsProvider;
}

/** An API app wired to in-memory stores and fake tokens, plus the stores for assertions. */
export function buildTestApp(options: TestAppOptions = {}) {
  const repo = createMemoryUserRepository(options.users);
  const appRepo = createMemoryAppRepository(options.apps);
  const verifier = createFakeVerifier(options.tokens ?? {});
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' };
  if (options.adminEmail) {
    env.ADMIN_EMAIL = options.adminEmail;
  }
  const deps = fakeDeps({
    verifier,
    users: repo,
    apps: appRepo,
    settings: createMemorySettingsRepository(options.studio ?? null),
    ...(options.provider ? { provider: options.provider } : {}),
  });
  const app = createApp(loadConfig(env), deps);
  return { app, repo, appRepo };
}

export const bearer = (token: string) => `Bearer ${token}`;
