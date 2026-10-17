import { DEFAULT_STUDIO_SETTINGS, hasPermission, ROLES } from '@growth/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, makeToken, makeUser } from './testing/fakes';

const people = ROLES.map((role) => makeUser({ email: `${role}@example.com`, role }));
const tokens = Object.fromEntries(
  people.map((person) => [`token-${person.role}`, makeToken(person.email)]),
);

function setup(studio?: Record<string, unknown>) {
  return buildTestApp({ users: people, tokens, ...(studio ? { studio } : {}) });
}

describe('GET /api/settings/studio', () => {
  it('answers with the defaults, marked as not configured, until the document exists', async () => {
    const { app } = setup();

    const res = await request(app)
      .get('/api/settings/studio')
      .set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ settings: DEFAULT_STUDIO_SETTINGS, configured: false });
  });

  it('answers with what the document holds', async () => {
    const { app } = setup({
      name: 'Example Studio',
      logoUrl: 'https://example.com/logo.svg',
      timezone: 'America/New_York',
      currency: 'usd',
      defaultDateRange: '7d',
    });

    const res = await request(app)
      .get('/api/settings/studio')
      .set('Authorization', bearer('token-growth'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      settings: {
        schemaVersion: 1,
        name: 'Example Studio',
        logoUrl: 'https://example.com/logo.svg',
        timezone: 'America/New_York',
        currency: 'USD',
        defaultDateRange: '7d',
      },
      configured: true,
    });
  });

  // The matrix decides. Today every role may read the studio's settings, so every role gets them;
  // if a role ever loses `settings:read`, this test says it must be refused.
  it.each([...ROLES])('gives the %s role what the permission matrix says', async (role) => {
    const { app } = setup();

    const res = await request(app)
      .get('/api/settings/studio')
      .set('Authorization', bearer(`token-${role}`));

    expect(res.status).toBe(hasPermission(role, 'settings:read') ? 200 : 403);
  });

  it('answers 503 with what to fix when the document is not valid', async () => {
    const { app } = setup({ timezone: 'Mars/Olympus' });

    const res = await request(app)
      .get('/api/settings/studio')
      .set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('studio_settings_invalid');
    expect(res.body.error.message).toContain('Server setup problem');
    expect(res.body.error.message).toContain('timezone:');
  });

  it('asks for sign-in first', async () => {
    const { app } = setup();

    const res = await request(app).get('/api/settings/studio');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('does not open to someone who has not been invited', async () => {
    const { app } = buildTestApp({
      users: people,
      tokens: { ...tokens, 'token-stranger': makeToken('stranger@example.com') },
    });

    const res = await request(app)
      .get('/api/settings/studio')
      .set('Authorization', bearer('token-stranger'));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not_invited');
  });
});
