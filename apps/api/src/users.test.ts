import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, makeToken, makeUser } from './testing/fakes';

const admin = makeUser({ email: 'admin@example.com', role: 'admin' });
const second = makeUser({ email: 'second@example.com', role: 'admin' });
const growth = makeUser({ email: 'growth@example.com', role: 'growth' });
const developer = makeUser({ email: 'dev@example.com', role: 'developer' });

const tokens = {
  'token-admin': makeToken(admin.email),
  'token-second': makeToken(second.email),
  'token-growth': makeToken(growth.email),
  'token-dev': makeToken(developer.email),
  'token-newbie': makeToken('newbie@example.com'),
};

function setup(users = [admin, second, growth, developer]) {
  return buildTestApp({ users, tokens });
}

const encode = encodeURIComponent;

describe('GET /api/users', () => {
  it('lists everyone, admins first, for an admin', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/users').set('Authorization', bearer('token-admin'));
    expect(res.status).toBe(200);
    expect(res.body.users.map((user: { email: string }) => user.email)).toEqual([
      'admin@example.com',
      'second@example.com',
      'growth@example.com',
      'dev@example.com',
    ]);
  });

  it('is forbidden for growth and developer roles', async () => {
    const { app } = setup();
    for (const token of ['token-growth', 'token-dev']) {
      const res = await request(app).get('/api/users').set('Authorization', bearer(token));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
    }
  });
});

describe('POST /api/users (invite)', () => {
  it('creates an active user who has not signed in yet', async () => {
    const { app, repo } = setup();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('token-admin'))
      .send({ email: ' Newbie@Example.com ', role: 'developer' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'newbie@example.com',
      role: 'developer',
      active: true,
      uid: null,
      name: null,
      createdBy: admin.email,
    });
    expect(repo.all().map((user) => user.email)).toContain('newbie@example.com');
  });

  it('lets the invited person sign in straight away', async () => {
    const { app } = setup();
    await request(app)
      .post('/api/users')
      .set('Authorization', bearer('token-admin'))
      .send({ email: 'newbie@example.com', role: 'growth' });
    const res = await request(app).get('/api/me').set('Authorization', bearer('token-newbie'));
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('growth');
  });

  it('rejects an email that already has access', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('token-admin'))
      .send({ email: 'GROWTH@example.com', role: 'admin' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('user_exists');
  });

  it('rejects an invalid email or role', async () => {
    const { app } = setup();
    const badEmail = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('token-admin'))
      .send({ email: 'not-an-email', role: 'growth' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe('validation_error');

    const badRole = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('token-admin'))
      .send({ email: 'x@example.com', role: 'owner' });
    expect(badRole.status).toBe(400);
  });

  it('is forbidden for non-admins and changes nothing', async () => {
    const { app, repo } = setup();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', bearer('token-growth'))
      .send({ email: 'newbie@example.com', role: 'admin' });
    expect(res.status).toBe(403);
    expect(repo.all()).toHaveLength(4);
  });
});

describe('PATCH /api/users/:email', () => {
  it('changes a role', async () => {
    const { app, repo } = setup();
    const res = await request(app)
      .patch(`/api/users/${encode(growth.email)}`)
      .set('Authorization', bearer('token-admin'))
      .send({ role: 'developer' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('developer');
    expect(repo.all().find((user) => user.email === growth.email)?.role).toBe('developer');
  });

  it('cuts off a deactivated user immediately', async () => {
    const { app } = setup();
    const patch = await request(app)
      .patch(`/api/users/${encode(growth.email)}`)
      .set('Authorization', bearer('token-admin'))
      .send({ active: false });
    expect(patch.status).toBe(200);
    expect(patch.body.user.active).toBe(false);

    const res = await request(app).get('/api/me').set('Authorization', bearer('token-growth'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_disabled');
  });

  it('returns 404 for an unknown user', async () => {
    const { app } = setup();
    const res = await request(app)
      .patch(`/api/users/${encode('nobody@example.com')}`)
      .set('Authorization', bearer('token-admin'))
      .send({ role: 'growth' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('user_not_found');
  });

  it('rejects an empty update', async () => {
    const { app } = setup();
    const res = await request(app)
      .patch(`/api/users/${encode(growth.email)}`)
      .set('Authorization', bearer('token-admin'))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('is forbidden for non-admins', async () => {
    const { app } = setup();
    const res = await request(app)
      .patch(`/api/users/${encode(developer.email)}`)
      .set('Authorization', bearer('token-growth'))
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });
});

describe('the last active admin', () => {
  it('cannot be demoted or deactivated', async () => {
    const { app } = setup([admin, growth]);
    const demote = await request(app)
      .patch(`/api/users/${encode(admin.email)}`)
      .set('Authorization', bearer('token-admin'))
      .send({ role: 'growth' });
    expect(demote.status).toBe(409);
    expect(demote.body.error.code).toBe('last_admin');

    const deactivate = await request(app)
      .patch(`/api/users/${encode(admin.email)}`)
      .set('Authorization', bearer('token-admin'))
      .send({ active: false });
    expect(deactivate.status).toBe(409);
    expect(deactivate.body.error.code).toBe('last_admin');
  });

  it('can be replaced: with two admins one may step down, then the other is protected', async () => {
    const { app } = setup();
    const stepDown = await request(app)
      .patch(`/api/users/${encode(second.email)}`)
      .set('Authorization', bearer('token-admin'))
      .send({ role: 'growth' });
    expect(stepDown.status).toBe(200);

    const blocked = await request(app)
      .patch(`/api/users/${encode(admin.email)}`)
      .set('Authorization', bearer('token-admin'))
      .send({ role: 'developer' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('last_admin');
  });

  it('does not count a deactivated admin as a replacement', async () => {
    const inactive = makeUser({ email: 'old@example.com', role: 'admin', active: false });
    const { app } = setup([admin, inactive]);
    const res = await request(app)
      .patch(`/api/users/${encode(admin.email)}`)
      .set('Authorization', bearer('token-admin'))
      .send({ active: false });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('last_admin');
  });
});
