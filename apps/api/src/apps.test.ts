import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, makeToken, makeUser } from './testing/fakes';
import { makeApp } from './testing/apps';

const admin = makeUser({ email: 'admin@example.com', role: 'admin' });
const growth = makeUser({ email: 'growth@example.com', role: 'growth' });
const developer = makeUser({ email: 'dev@example.com', role: 'developer' });

const tokens = {
  'token-admin': makeToken(admin.email),
  'token-growth': makeToken(growth.email),
  'token-dev': makeToken(developer.email),
};

const quest = makeApp({ id: 'quest', name: 'Grind Quest', packageName: 'com.example.grindquest' });
const toolkit = makeApp({
  id: 'toolkit',
  name: 'PDF Toolkit',
  packageName: 'com.example.pdftoolkit',
  ga4PropertyId: '123456789',
});

function setup(apps = [toolkit, quest]) {
  return buildTestApp({ users: [admin, growth, developer], tokens, apps });
}

/** Every role that may only read: the apps are visible to everyone, but changed by admins alone. */
const readers = ['token-growth', 'token-dev'];

describe('GET /api/apps', () => {
  it.each(['token-admin', ...readers])('lists the apps by name for %s', async (token) => {
    const { app } = setup();

    const res = await request(app).get('/api/apps').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.apps.map((entry: { name: string }) => entry.name)).toEqual([
      'Grind Quest',
      'PDF Toolkit',
    ]);
    expect(res.body.apps[1]).toMatchObject({ id: 'toolkit', ga4PropertyId: '123456789' });
  });

  it('lists nothing for a studio with no apps yet', async () => {
    const { app } = setup([]);

    const res = await request(app).get('/api/apps').set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ apps: [] });
  });

  it('asks for sign-in first', async () => {
    const { app } = setup();

    const res = await request(app).get('/api/apps');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });
});

describe('GET /api/apps/:id', () => {
  it.each(['token-admin', ...readers])('returns one app to %s', async (token) => {
    const { app } = setup();

    const res = await request(app).get('/api/apps/quest').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.app).toMatchObject({ id: 'quest', name: 'Grind Quest' });
  });

  it('says there is no such app', async () => {
    const { app } = setup();

    const res = await request(app)
      .get('/api/apps/nope')
      .set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('app_not_found');
  });

  it('refuses an id that could point at another document', async () => {
    const { app } = setup();

    const res = await request(app)
      .get('/api/apps/quest%2Fsecret')
      .set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});

describe('POST /api/apps', () => {
  it('adds an app, trims what was typed and fills in the rest', async () => {
    const { app, appRepo } = setup();

    const res = await request(app)
      .post('/api/apps')
      .set('Authorization', bearer('token-admin'))
      .send({
        name: '  ID Photo Maker ',
        packageName: 'com.example.idphoto',
        status: 'testing',
        ga4PropertyId: 'properties/987654321',
        playStoreUrl: '',
      });

    expect(res.status).toBe(201);
    expect(res.body.app).toMatchObject({
      name: 'ID Photo Maker',
      packageName: 'com.example.idphoto',
      status: 'testing',
      ga4PropertyId: '987654321',
      playStoreUrl: null,
      iconUrl: null,
      createdBy: admin.email,
    });
    expect(typeof res.body.app.id).toBe('string');
    expect(appRepo.all().map((entry) => entry.name)).toContain('ID Photo Maker');
  });

  it('starts an app in development unless told otherwise', async () => {
    const { app } = setup();

    const res = await request(app)
      .post('/api/apps')
      .set('Authorization', bearer('token-admin'))
      .send({ name: 'New', packageName: 'com.example.new' });

    expect(res.status).toBe(201);
    expect(res.body.app.status).toBe('development');
  });

  it('lists every problem with what was sent', async () => {
    const { app, appRepo } = setup();

    const res = await request(app)
      .post('/api/apps')
      .set('Authorization', bearer('token-admin'))
      .send({ name: '', packageName: 'nodots', iconUrl: 'http://example.com/a.png' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.message).toContain('name:');
    expect(res.body.error.message).toContain('packageName:');
    expect(res.body.error.message).toContain('iconUrl:');
    expect(appRepo.all()).toHaveLength(2);
  });

  it('asks for a body', async () => {
    const { app } = setup();

    const res = await request(app).post('/api/apps').set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('refuses a package name that is taken, in any letter case', async () => {
    const { app, appRepo } = setup();

    const res = await request(app)
      .post('/api/apps')
      .set('Authorization', bearer('token-admin'))
      .send({ name: 'Copy', packageName: 'COM.example.GrindQuest' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('package_name_taken');
    expect(appRepo.all()).toHaveLength(2);
  });

  it.each(readers)('is forbidden for %s, and changes nothing', async (token) => {
    const { app, appRepo } = setup();

    const res = await request(app)
      .post('/api/apps')
      .set('Authorization', bearer(token))
      .send({ name: 'New', packageName: 'com.example.new' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    expect(appRepo.all()).toHaveLength(2);
  });

  it('is forbidden before it looks at what was sent', async () => {
    const { app } = setup();

    const res = await request(app)
      .post('/api/apps')
      .set('Authorization', bearer('token-growth'))
      .send({});

    expect(res.status).toBe(403);
  });

  it('asks for sign-in first', async () => {
    const { app } = setup();

    const res = await request(app).post('/api/apps').send({ name: 'x', packageName: 'a.b' });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/apps/:id', () => {
  it('changes only what was sent', async () => {
    const { app, appRepo } = setup();

    const res = await request(app)
      .patch('/api/apps/toolkit')
      .set('Authorization', bearer('token-admin'))
      .send({ currentVersion: '2.1.0', status: 'production' });

    expect(res.status).toBe(200);
    expect(res.body.app).toMatchObject({
      name: 'PDF Toolkit',
      ga4PropertyId: '123456789',
      currentVersion: '2.1.0',
      status: 'production',
    });
    expect(appRepo.all().find((entry) => entry.id === 'toolkit')?.currentVersion).toBe('2.1.0');
  });

  it('clears an optional field sent as null', async () => {
    const { app } = setup();

    const res = await request(app)
      .patch('/api/apps/toolkit')
      .set('Authorization', bearer('token-admin'))
      .send({ ga4PropertyId: null });

    expect(res.status).toBe(200);
    expect(res.body.app.ga4PropertyId).toBeNull();
  });

  it('says there is no such app', async () => {
    const { app } = setup();

    const res = await request(app)
      .patch('/api/apps/nope')
      .set('Authorization', bearer('token-admin'))
      .send({ name: 'x' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('app_not_found');
  });

  it('refuses an empty change', async () => {
    const { app } = setup();

    const res = await request(app)
      .patch('/api/apps/toolkit')
      .set('Authorization', bearer('token-admin'))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Provide at least one field to change');
  });

  it('refuses a package name that another app uses, and changes nothing', async () => {
    const { app, appRepo } = setup();
    const before = appRepo.all();

    const res = await request(app)
      .patch('/api/apps/toolkit')
      .set('Authorization', bearer('token-admin'))
      .send({ name: 'Renamed', packageName: 'com.example.grindquest' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('package_name_taken');
    expect(appRepo.all()).toEqual(before);
  });

  it.each(readers)('is forbidden for %s, and changes nothing', async (token) => {
    const { app, appRepo } = setup();
    const before = appRepo.all();

    const res = await request(app)
      .patch('/api/apps/toolkit')
      .set('Authorization', bearer(token))
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);
    expect(appRepo.all()).toEqual(before);
  });
});

describe('DELETE /api/apps/:id', () => {
  it('deletes the app and answers with no content', async () => {
    const { app, appRepo } = setup();

    const res = await request(app)
      .delete('/api/apps/toolkit')
      .set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(appRepo.all().map((entry) => entry.id)).toEqual(['quest']);
  });

  it('says there is no such app, the second time', async () => {
    const { app } = setup();
    await request(app).delete('/api/apps/toolkit').set('Authorization', bearer('token-admin'));

    const res = await request(app)
      .delete('/api/apps/toolkit')
      .set('Authorization', bearer('token-admin'));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('app_not_found');
  });

  it.each(readers)('is forbidden for %s, and changes nothing', async (token) => {
    const { app, appRepo } = setup();

    const res = await request(app).delete('/api/apps/toolkit').set('Authorization', bearer(token));

    expect(res.status).toBe(403);
    expect(appRepo.all()).toHaveLength(2);
  });
});
