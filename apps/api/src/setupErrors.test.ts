import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import type { TokenVerifier } from './auth/types';
import { loadConfig } from './lib/config';
import { bearer, createFakeVerifier, fakeDeps, makeToken } from './testing/fakes';
import { createMemoryUserRepository } from './testing/memoryUserRepository';
import type { UserRepository } from './users/types';

// What people see when the API is set up wrongly: a clear 503 instead of "Something went wrong".

const goodTokens = createFakeVerifier({ 'token-admin': makeToken('admin@example.com') });

function appWith(verifier: TokenVerifier, users: UserRepository) {
  return createApp(
    loadConfig({ NODE_ENV: 'test', ADMIN_EMAIL: 'admin@example.com' }),
    fakeDeps({ verifier, users }),
  );
}

/** A database that fails every call with this error, like Firestore without credentials. */
function failingRepository(error: Error): UserRepository {
  return {
    get: () => Promise.reject(error),
    list: () => Promise.reject(error),
    runTransaction: () => Promise.reject(error),
  };
}

/** Collects what the API writes to the error log, parsed from its JSON lines. */
function captureErrorLog() {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return {
    lines: () =>
      spy.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('when the database cannot be used', () => {
  const noCredentials = new Error(
    'Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.',
  );

  it('answers 503 with what to change, instead of a bare server error', async () => {
    captureErrorLog();
    const app = appWith(goodTokens, failingRepository(noCredentials));

    const res = await request(app).get('/api/me').set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('database_unavailable');
    expect(res.body.error.message).toContain('GOOGLE_APPLICATION_CREDENTIALS');
  });

  it('does not repeat the original error text to the caller', async () => {
    captureErrorLog();
    const app = appWith(goodTokens, failingRepository(noCredentials));

    const res = await request(app).get('/api/me').set('Authorization', bearer('token-admin'));

    expect(JSON.stringify(res.body)).not.toContain('cloud.google.com');
  });

  it('logs what happened, with the original message under its own key', async () => {
    const log = captureErrorLog();
    const app = appWith(goodTokens, failingRepository(noCredentials));

    await request(app).get('/api/me').set('Authorization', bearer('token-admin'));

    const entry = log.lines().find((line) => line.message === 'Database unavailable');
    expect(entry).toBeDefined();
    expect(entry?.problem).toBe('no_credentials');
    expect(String(entry?.errorMessage)).toContain('Could not load the default credentials');
  });

  it('explains a project without a database', async () => {
    captureErrorLog();
    const missing = Object.assign(
      new Error('5 NOT_FOUND: The database (default) does not exist for project demo.'),
      { code: 5 },
    );
    const app = appWith(goodTokens, failingRepository(missing));

    const res = await request(app).get('/api/me').set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(503);
    expect(res.body.error.message).toContain('no Firestore database');
  });

  it('still answers other unexpected errors with a plain 500 and logs their details', async () => {
    const log = captureErrorLog();
    const app = appWith(goodTokens, failingRepository(new Error('something odd')));

    const res = await request(app).get('/api/me').set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({ code: 'internal_error', message: 'Something went wrong' });
    const entry = log.lines().find((line) => line.message === 'Unhandled error');
    expect(String(entry?.errorMessage)).toBe('something odd');
  });
});

describe('when the sign-in service cannot be reached', () => {
  function brokenVerifier(code: string): TokenVerifier {
    return {
      verify: () =>
        Promise.reject(Object.assign(new Error('Error while making request'), { code })),
    };
  }

  it.each(['app/network-error', 'app/network-timeout', 'auth/internal-error'])(
    'answers 503 for %s rather than blaming the person’s session',
    async (code) => {
      captureErrorLog();
      const app = appWith(brokenVerifier(code), createMemoryUserRepository());

      const res = await request(app).get('/api/me').set('Authorization', bearer('anything'));

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('auth_unavailable');
    },
  );
});

/** What the Admin SDK says when a token's audience is not the API's project. */
function audienceError(expected: string, got: string): TokenVerifier {
  const error = Object.assign(
    new Error(
      `Firebase ID token has incorrect "aud" (audience) claim. Expected "${expected}" but got "${got}".`,
    ),
    { code: 'auth/argument-error' },
  );
  return { verify: () => Promise.reject(error) };
}

describe('when the token belongs to another Firebase project', () => {
  const verifier = audienceError('my-studio', 'other-studio');

  it('answers 503 and names the project signed in to and the one the API uses', async () => {
    captureErrorLog();
    const app = appWith(verifier, createMemoryUserRepository());

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', bearer('secret-token-value'));

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('project_mismatch');
    const message: string = res.body.error.message;
    expect(message).toContain('signed in to the Firebase project "other-studio"');
    expect(message).toContain('the API is set up for "my-studio"');
    expect(message).toContain('VITE_FIREBASE_API_KEY');
    expect(message).toContain('FIREBASE_PROJECT_ID');
    expect(JSON.stringify(res.body)).not.toContain('secret-token-value');
  });

  it('still answers when the SDK does not name the projects', async () => {
    captureErrorLog();
    const vague: TokenVerifier = {
      verify: () =>
        Promise.reject(
          Object.assign(new Error('Firebase ID token has incorrect "aud" (audience) claim.'), {
            code: 'auth/argument-error',
          }),
        ),
    };
    const app = appWith(vague, createMemoryUserRepository());

    const res = await request(app).get('/api/me').set('Authorization', bearer('some-token'));

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('project_mismatch');
    expect(res.body.error.message).toContain('a different Firebase project than the one the API');
  });

  it('logs both project ids, and never the token', async () => {
    const log = captureErrorLog();
    const app = appWith(verifier, createMemoryUserRepository());

    await request(app).get('/api/me').set('Authorization', bearer('secret-token-value'));

    const entry = log
      .lines()
      .find(
        (line) => line.message === 'ID token belongs to a different Firebase project than the API',
      );
    expect(String(entry?.errorMessage)).toContain('Expected "my-studio" but got "other-studio"');
    expect(JSON.stringify(log.lines())).not.toContain('secret-token-value');
  });
});

describe('when the sign-in came from a local emulator but the API uses a real project', () => {
  // The emulators run the project demo-growth, whatever project id the web app is set to.
  const verifier = audienceError('my-studio', 'demo-growth');

  it('says so, and names the emulator lines to remove', async () => {
    captureErrorLog();
    const app = appWith(verifier, createMemoryUserRepository());

    const res = await request(app).get('/api/me').set('Authorization', bearer('some-token'));

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('project_mismatch');
    const message: string = res.body.error.message;
    expect(message).toContain('through the local Firebase emulator (project "demo-growth")');
    expect(message).toContain('the real project "my-studio"');
    expect(message).toContain('VITE_FIREBASE_AUTH_EMULATOR_URL');
    expect(message).toContain('FIREBASE_AUTH_EMULATOR_HOST');
  });
});

describe('when the API is set up for an emulator project but the sign-in is a real one', () => {
  const verifier = audienceError('demo-growth', 'my-studio');

  it('says so, and names the real project to use', async () => {
    captureErrorLog();
    const app = appWith(verifier, createMemoryUserRepository());

    const res = await request(app).get('/api/me').set('Authorization', bearer('some-token'));

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('project_mismatch');
    const message: string = res.body.error.message;
    expect(message).toContain('signed in to the real Firebase project "my-studio"');
    expect(message).toContain('the emulator project "demo-growth"');
    expect(message).toContain('set FIREBASE_PROJECT_ID to "my-studio"');
  });
});

describe('when the token is simply not valid', () => {
  it('answers 401, and logs why without the token', async () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const verifier: TokenVerifier = {
      verify: () =>
        Promise.reject(
          Object.assign(new Error('Firebase ID token has expired.'), {
            code: 'auth/id-token-expired',
          }),
        ),
    };
    const app = appWith(verifier, createMemoryUserRepository());

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', bearer('secret-token-value'));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_token');
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('Firebase ID token has expired.');
    expect(logged).toContain('auth/id-token-expired');
    expect(logged).not.toContain('secret-token-value');
  });
});
