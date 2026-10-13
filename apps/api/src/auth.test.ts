import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, makeToken, makeUser } from './testing/fakes';

const admin = makeUser({ email: 'admin@example.com', role: 'admin' });
const growth = makeUser({ email: 'growth@example.com', role: 'growth' });
const deactivated = makeUser({ email: 'gone@example.com', active: false });
// Invited by an admin but has never signed in, so there is no uid yet.
const invited = makeUser({ email: 'new@example.com', role: 'developer', uid: null });

const tokens = {
  'token-admin': makeToken(admin.email),
  'token-growth': makeToken(growth.email),
  'token-gone': makeToken(deactivated.email),
  'token-new': makeToken(invited.email, { name: 'Nia New' }),
  'token-stranger': makeToken('stranger@example.com'),
  'token-unverified': makeToken(admin.email, { emailVerified: false }),
  'token-no-email': makeToken(admin.email, { email: undefined }),
  'token-boss': makeToken('boss@example.com', { name: 'The Boss' }),
};

function setup(adminEmail?: string) {
  return buildTestApp({ users: [admin, growth, deactivated, invited], tokens, adminEmail });
}

describe('authentication', () => {
  it('rejects a request without a token', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('rejects an authorization header that is not a bearer token', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('rejects a token that does not verify', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', bearer('nope'));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_token');
  });

  it('rejects an account that has not been invited, naming the account', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-stranger'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not_invited');
    // People with several Google accounts need to see which one they used.
    expect(res.body.error.message).toContain('stranger@example.com has not been given access');
  });

  it('rejects a deactivated account, naming the account', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-gone'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_disabled');
    expect(res.body.error.message).toContain('gone@example.com has been deactivated');
  });

  it('rejects an email address the provider has not verified', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-unverified'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('email_not_verified');
  });

  it('rejects a token that carries no email address', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-no-email'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('email_required');
  });
});

describe('GET /api/me', () => {
  it('returns the caller and the permissions of their role', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-growth'));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ email: growth.email, name: null, role: 'growth' });
    expect(res.body.permissions).toContain('campaigns:write');
    expect(res.body.permissions).not.toContain('users:manage');
  });

  it('records the sign-in time', async () => {
    const { app, repo } = setup();
    await request(app).get('/api/me').set('Authorization', bearer('token-growth'));
    const stored = repo.all().find((user) => user.email === growth.email);
    expect(stored?.lastLoginAt).toEqual(expect.any(String));
  });

  it('links the Firebase account and copies the Google name on first sign-in', async () => {
    const { app, repo } = setup();
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-new'));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ email: invited.email, name: 'Nia New', role: 'developer' });
    const stored = repo.all().find((user) => user.email === invited.email);
    expect(stored?.uid).toBe(`uid-${invited.email}`);
    expect(stored?.name).toBe('Nia New');
  });

  it('takes effect immediately when an account is deactivated', async () => {
    const { app, repo } = setup();
    const first = await request(app).get('/api/me').set('Authorization', bearer('token-growth'));
    expect(first.status).toBe(200);

    await repo.runTransaction(async (tx) => {
      const current = await tx.get(growth.email);
      if (current) tx.put({ ...current, active: false });
    });

    const second = await request(app).get('/api/me').set('Authorization', bearer('token-growth'));
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe('account_disabled');
  });
});

describe('bootstrap admin (ADMIN_EMAIL)', () => {
  it('creates the first admin on first sign-in', async () => {
    const { app, repo } = setup('Boss@Example.com');
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-boss'));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ email: 'boss@example.com', name: 'The Boss', role: 'admin' });
    const stored = repo.all().find((user) => user.email === 'boss@example.com');
    expect(stored).toMatchObject({ role: 'admin', active: true, uid: 'uid-boss@example.com' });
  });

  it('does not let anyone else in', async () => {
    const { app } = setup('boss@example.com');
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-stranger'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not_invited');
  });

  it('does not let strangers in when ADMIN_EMAIL is not set', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-boss'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not_invited');
  });

  it('does not bring back a deactivated bootstrap admin', async () => {
    const boss = makeUser({ email: 'boss@example.com', role: 'admin', active: false });
    const { app } = buildTestApp({
      users: [boss],
      tokens: { 'token-boss': makeToken(boss.email) },
      adminEmail: boss.email,
    });
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-boss'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_disabled');
  });
});

describe('unknown routes under /api', () => {
  it('ask for sign-in before revealing anything', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(401);
  });

  it('return the standard 404 for signed-in users', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/nope').set('Authorization', bearer('token-admin'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
