import type { UserRecord } from '@growth/shared';
import { createApp } from '../app';
import type { TokenVerifier, VerifiedToken } from '../auth/types';
import { loadConfig } from '../lib/config';
import { createMemoryUserRepository } from './memoryUserRepository';

export const FIXED_TIME = '2026-10-11T12:00:00.000Z';

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

export interface TestAppOptions {
  users?: UserRecord[];
  tokens?: Record<string, VerifiedToken>;
  adminEmail?: string;
}

/** An API app wired to an in-memory user store and fake tokens, plus the store for assertions. */
export function buildTestApp(options: TestAppOptions = {}) {
  const repo = createMemoryUserRepository(options.users);
  const verifier = createFakeVerifier(options.tokens ?? {});
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' };
  if (options.adminEmail) {
    env.ADMIN_EMAIL = options.adminEmail;
  }
  const app = createApp(loadConfig(env), { verifier, users: repo });
  return { app, repo };
}

export const bearer = (token: string) => `Bearer ${token}`;
