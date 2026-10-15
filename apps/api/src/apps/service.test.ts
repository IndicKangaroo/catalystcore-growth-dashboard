import { createAppSchema, updateAppSchema } from '@growth/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../middleware/errors';
import { createMemoryAppRepository } from '../testing/memoryAppRepository';
import { makeApp } from '../testing/apps';
import { createAppService } from './service';

const ACTOR = 'admin@example.com';

/** A clock that moves one minute with every reading, so "when" can be told apart. */
function steppingClock() {
  let minute = 0;
  return () => new Date(Date.UTC(2026, 9, 14, 10, minute++, 0));
}

function setup(seed = [makeApp({ id: 'app-a', name: 'Alpha', packageName: 'com.example.alpha' })]) {
  const repo = createMemoryAppRepository(seed);
  const service = createAppService({ repo, now: steppingClock() });
  return { repo, service };
}

const input = (fields: Record<string, unknown>) =>
  createAppSchema.parse({ name: 'New App', packageName: 'com.example.new', ...fields });

const patch = (fields: Record<string, unknown>) => updateAppSchema.parse(fields);

async function failure(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('Expected the call to fail');
}

describe('create', () => {
  it('stores the app with an id, the time and who added it', async () => {
    const { service, repo } = setup();

    const created = await service.create(input({ status: 'production', category: 'Tools' }), ACTOR);

    expect(created).toMatchObject({
      name: 'New App',
      packageName: 'com.example.new',
      status: 'production',
      category: 'Tools',
      ga4PropertyId: null,
      createdBy: ACTOR,
      createdAt: '2026-10-14T10:00:00.000Z',
      updatedAt: '2026-10-14T10:00:00.000Z',
    });
    expect(created.id).not.toBe('app-a');
    expect(repo.all().map((app) => app.id)).toContain(created.id);
  });

  it('gives every app a different id', async () => {
    const { service } = setup([]);

    const first = await service.create(input({ packageName: 'com.example.one' }), ACTOR);
    const second = await service.create(input({ packageName: 'com.example.two' }), ACTOR);

    expect(first.id).not.toBe(second.id);
  });

  it('refuses a package name that is taken, whatever its letter case', async () => {
    const { service, repo } = setup();

    const error = await failure(service.create(input({ packageName: 'COM.Example.Alpha' }), ACTOR));

    expect(error.status).toBe(409);
    expect(error.code).toBe('package_name_taken');
    expect(error.message).toContain('Alpha already uses the package name COM.Example.Alpha');
    expect(repo.all()).toHaveLength(1);
  });
});

describe('get and list', () => {
  it('returns one app, or says there is no such app', async () => {
    const { service } = setup();

    expect((await service.get('app-a')).name).toBe('Alpha');
    const error = await failure(service.get('nope'));
    expect(error.status).toBe(404);
    expect(error.code).toBe('app_not_found');
  });

  it('lists apps by name, ignoring letter case', async () => {
    const { service } = setup([
      makeApp({ id: 'c', name: 'charlie', packageName: 'com.example.c' }),
      makeApp({ id: 'a', name: 'Alpha', packageName: 'com.example.a' }),
      makeApp({ id: 'b', name: 'bravo', packageName: 'com.example.b' }),
    ]);

    expect((await service.list()).map((app) => app.name)).toEqual(['Alpha', 'bravo', 'charlie']);
  });

  it('keeps the order of apps with the same name steady', async () => {
    const { service } = setup([
      makeApp({ id: 'y', name: 'Same', packageName: 'com.example.y' }),
      makeApp({ id: 'x', name: 'Same', packageName: 'com.example.x' }),
    ]);

    expect((await service.list()).map((app) => app.id)).toEqual(['x', 'y']);
  });

  it('lists nothing for a studio with no apps yet', async () => {
    const { service } = setup([]);

    expect(await service.list()).toEqual([]);
  });
});

describe('update', () => {
  it('changes only what was sent, and says when', async () => {
    const { service } = setup([
      makeApp({
        id: 'app-a',
        name: 'Alpha',
        packageName: 'com.example.alpha',
        category: 'Games',
        currentVersion: '1.0.0',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'first@example.com',
      }),
    ]);

    const updated = await service.update('app-a', patch({ currentVersion: '1.1.0' }));

    expect(updated).toMatchObject({
      name: 'Alpha',
      category: 'Games',
      currentVersion: '1.1.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'first@example.com',
      updatedAt: '2026-10-14T10:00:00.000Z',
    });
    expect(await service.get('app-a')).toEqual(updated);
  });

  it('clears an optional field that was sent as null or blank', async () => {
    const { service } = setup([
      makeApp({
        id: 'app-a',
        name: 'Alpha',
        packageName: 'com.example.alpha',
        ga4PropertyId: '123456789',
        category: 'Games',
      }),
    ]);

    const updated = await service.update('app-a', patch({ ga4PropertyId: null, category: '  ' }));

    expect(updated.ga4PropertyId).toBeNull();
    expect(updated.category).toBeNull();
  });

  it('changes the status', async () => {
    const { service } = setup();

    expect((await service.update('app-a', patch({ status: 'development' }))).status).toBe(
      'development',
    );
  });

  it('says there is no such app', async () => {
    const { service } = setup();

    const error = await failure(service.update('nope', patch({ name: 'x' })));

    expect(error.status).toBe(404);
    expect(error.code).toBe('app_not_found');
  });

  it('refuses a package name another app uses, and changes nothing', async () => {
    const { service, repo } = setup([
      makeApp({ id: 'app-a', name: 'Alpha', packageName: 'com.example.alpha' }),
      makeApp({ id: 'app-b', name: 'Bravo', packageName: 'com.example.bravo' }),
    ]);
    const before = repo.all();

    const error = await failure(
      service.update('app-b', patch({ name: 'Renamed', packageName: 'com.example.ALPHA' })),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('package_name_taken');
    expect(repo.all()).toEqual(before);
  });

  it('lets an app keep its own package name, in any letter case', async () => {
    const { service } = setup();

    const same = await service.update('app-a', patch({ packageName: 'com.example.alpha' }));
    const recased = await service.update('app-a', patch({ packageName: 'com.example.Alpha' }));

    expect(same.packageName).toBe('com.example.alpha');
    expect(recased.packageName).toBe('com.example.Alpha');
  });

  it('moves an app to a package name that is free', async () => {
    const { service } = setup();

    expect(
      (await service.update('app-a', patch({ packageName: 'com.example.beta' }))).packageName,
    ).toBe('com.example.beta');
  });
});

describe('remove', () => {
  it('deletes the app', async () => {
    const { service, repo } = setup();

    await service.remove('app-a');

    expect(repo.all()).toEqual([]);
  });

  it('says there is no such app, the second time', async () => {
    const { service } = setup();
    await service.remove('app-a');

    const error = await failure(service.remove('app-a'));

    expect(error.status).toBe(404);
    expect(error.code).toBe('app_not_found');
  });

  it('frees the package name for another app', async () => {
    const { service } = setup();
    await service.remove('app-a');

    const created = await service.create(input({ packageName: 'com.example.alpha' }), ACTOR);

    expect(created.packageName).toBe('com.example.alpha');
  });
});
