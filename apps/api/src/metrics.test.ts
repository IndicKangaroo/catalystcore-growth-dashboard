import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from './testing/apps';
import { bearer, buildTestApp, makeToken, makeUser } from './testing/fakes';

const admin = makeUser({ email: 'admin@example.com', role: 'admin' });
const growth = makeUser({ email: 'growth@example.com', role: 'growth' });
const developer = makeUser({ email: 'dev@example.com', role: 'developer' });
const deactivated = makeUser({ email: 'gone@example.com', role: 'growth', active: false });

const tokens = {
  'token-admin': makeToken(admin.email),
  'token-growth': makeToken(growth.email),
  'token-dev': makeToken(developer.email),
  'token-gone': makeToken(deactivated.email),
  'token-stranger': makeToken('stranger@example.com'),
};

const quest = makeApp({ id: 'quest', name: 'Grind Quest', launchDate: '2026-01-05' });
const toolkit = makeApp({ id: 'toolkit', name: 'PDF Toolkit', launchDate: '2026-02-10' });

function setup(apps = [toolkit, quest]) {
  return buildTestApp({ users: [admin, growth, developer, deactivated], tokens, apps });
}

const RANGE = 'from=2026-09-01&to=2026-09-30';

/** Every metrics route, so that the access rules are checked the same way on each one. */
const routes = [
  ['overview', `/api/metrics/overview?${RANGE}`],
  ['series', `/api/metrics/series?${RANGE}&metric=active_users`],
  ['app users', `/api/apps/quest/users?${RANGE}`],
  ['app retention', `/api/apps/quest/retention?${RANGE}`],
] as const;

const allowed = ['token-admin', 'token-growth', 'token-dev'] as const;

describe.each(routes)('GET the %s', (_name, path) => {
  it.each(allowed)('answers %s with demo data, labelled as such', async (token) => {
    const { app } = setup();

    const res = await request(app).get(path).set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('seed');
    expect(res.body.range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('asks for sign-in first', async () => {
    const { app } = setup();

    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('refuses someone who was never invited', async () => {
    const { app } = setup();

    const res = await request(app).get(path).set('Authorization', bearer('token-stranger'));

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.source).toBeUndefined();
  });

  it('refuses someone who was deactivated', async () => {
    const { app } = setup();

    const res = await request(app).get(path).set('Authorization', bearer('token-gone'));

    expect(res.status).toBe(403);
    expect(res.body.source).toBeUndefined();
  });
});

describe('GET /api/metrics/overview', () => {
  it('has the totals the Overview needs, each one a number or a stated reason', async () => {
    const { app } = setup();

    const res = await request(app)
      .get(`/api/metrics/overview?${RANGE}`)
      .set('Authorization', bearer('token-growth'));

    for (const field of ['activeUsers', 'newUsers', 'sessions', 'averageRetention']) {
      expect(res.body[field].state).toBe('ok');
      expect(res.body[field].value).toBeGreaterThan(0);
    }
    // Installs and revenue need a store or ad integration, so even the demo does not invent them.
    expect(res.body.installs).toEqual({ state: 'not_connected' });
    expect(res.body.revenue).toEqual({ state: 'not_connected' });
  });

  it('narrows to the chosen apps', async () => {
    const { app } = setup();
    const get = (extra: string) =>
      request(app)
        .get(`/api/metrics/overview?${RANGE}${extra}`)
        .set('Authorization', bearer('token-growth'));

    const all = await get('');
    const one = await get('&appIds=quest');

    expect(one.body.appsWithData).toBe(1);
    expect(all.body.appsWithData).toBe(2);
    expect(one.body.newUsers.value).toBeLessThan(all.body.newUsers.value);
  });

  it('answers 404 for an app that does not exist', async () => {
    const { app } = setup();

    const res = await request(app)
      .get(`/api/metrics/overview?${RANGE}&appIds=quest,ghost`)
      .set('Authorization', bearer('token-growth'));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('app_not_found');
  });

  it('says what is wrong with a query it cannot understand', async () => {
    const { app } = setup();
    const get = (query: string) =>
      request(app)
        .get(`/api/metrics/overview?${query}`)
        .set('Authorization', bearer('token-admin'));

    const missing = await get('');
    const backwards = await get('from=2026-09-30&to=2026-09-01');
    const tooLong = await get('from=2025-01-01&to=2026-09-30');

    for (const res of [missing, backwards, tooLong]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
    }
    expect(backwards.body.error.message).toContain('The start date is after the end date');
    expect(tooLong.body.error.message).toContain('Choose at most 366 days');
  });

  it('is forbidden before it looks at the query', async () => {
    const { app } = setup();

    const res = await request(app)
      .get('/api/metrics/overview?from=nonsense')
      .set('Authorization', bearer('token-stranger'));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/metrics/series', () => {
  it('has one point per day in the range', async () => {
    const { app } = setup();

    const res = await request(app)
      .get(`/api/metrics/series?${RANGE}&metric=sessions`)
      .set('Authorization', bearer('token-dev'));

    expect(res.body.metric).toBe('sessions');
    expect(res.body.data.state).toBe('ok');
    expect(res.body.data.points).toHaveLength(30);
    expect(res.body.data.points[0].date).toBe('2026-09-01');
    expect(res.body.data.points[29].date).toBe('2026-09-30');
  });

  it('needs a known metric', async () => {
    const { app } = setup();
    const get = (path: string) => request(app).get(path).set('Authorization', bearer('token-dev'));

    const none = await get(`/api/metrics/series?${RANGE}`);
    const unknown = await get(`/api/metrics/series?${RANGE}&metric=revenue`);

    expect(none.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('validation_error');
  });
});

describe('GET /api/apps/:id/users', () => {
  it('answers for that app', async () => {
    const { app } = setup();

    const res = await request(app)
      .get(`/api/apps/toolkit/users?${RANGE}`)
      .set('Authorization', bearer('token-growth'));

    expect(res.status).toBe(200);
    expect(res.body.appId).toBe('toolkit');
    expect(res.body.mau.state).toBe('ok');
    expect(res.body.dau.state).toBe('ok');
  });

  it('says there is no such app', async () => {
    const { app } = setup();

    const res = await request(app)
      .get(`/api/apps/nope/users?${RANGE}`)
      .set('Authorization', bearer('token-growth'));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('app_not_found');
  });

  it('refuses an id that could point at another document', async () => {
    const { app } = setup();

    const res = await request(app)
      .get(`/api/apps/quest%2Fsecret/users?${RANGE}`)
      .set('Authorization', bearer('token-growth'));

    expect(res.status).toBe(400);
  });

  it('still lets the apps router answer /api/apps/:id', async () => {
    const { app } = setup();

    const res = await request(app).get('/api/apps/quest').set('Authorization', bearer('token-dev'));

    expect(res.status).toBe(200);
    expect(res.body.app.id).toBe('quest');
  });
});

describe('GET /api/apps/:id/retention', () => {
  it('has the summary and the weekly cohorts, and a window that has not ended is "in progress"', async () => {
    const { app } = setup();
    // A range that runs up to today, so the newest cohorts have not reached day 30 yet.
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);

    const res = await request(app)
      .get(`/api/apps/quest/retention?from=${from}&to=${today}`)
      .set('Authorization', bearer('token-growth'));

    expect(res.status).toBe(200);
    expect(res.body.appId).toBe('quest');
    expect(res.body.cohorts.length).toBeGreaterThan(0);
    const states = res.body.cohorts.flatMap(
      (cohort: { retention: Record<string, { state: string }> }) =>
        Object.values(cohort.retention).map((cell) => cell.state),
    );
    expect(states).toContain('in_progress');
  });

  it('says there is no such app', async () => {
    const { app } = setup();

    const res = await request(app)
      .get(`/api/apps/nope/retention?${RANGE}`)
      .set('Authorization', bearer('token-growth'));

    expect(res.status).toBe(404);
  });
});
