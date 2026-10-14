import request from 'supertest';
import type { Express } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { loadConfig } from './lib/config';
import { createFirebaseDeps } from './lib/firebase';
import { bearer } from './testing/fakes';

// The unit tests fake Firebase. This file runs the real wiring (Admin SDK token checks, Firestore
// transactions) against the Firebase Auth and Firestore emulators, signing in the way the browser
// does with Google. Run it with `npm run test:emulator` in the repository root, which starts the
// emulators first (needs Java). It is left out of `npm run test` (see vitest.config.ts), and it
// fails, rather than skips, when the emulators are not there.

const PROJECT_ID = 'demo-growth';
const ADMIN_EMAIL = 'admin@example.com';

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

function emulatorUrl(host: string | undefined, path: string): string {
  if (!host) throw new Error('The emulators are not running');
  return `http://${host}${path}`;
}

async function expectOk(response: Response, what: string): Promise<void> {
  if (!response.ok) {
    throw new Error(`${what} failed: ${response.status} ${await response.text()}`);
  }
}

/** Empties both emulators, so every test starts with no accounts and no users. */
async function resetEmulators(): Promise<void> {
  const firestore = await fetch(
    emulatorUrl(firestoreHost, `/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`),
    { method: 'DELETE' },
  );
  await expectOk(firestore, 'Clearing Firestore');
  const auth = await fetch(emulatorUrl(authHost, `/emulator/v1/projects/${PROJECT_ID}/accounts`), {
    method: 'DELETE',
  });
  await expectOk(auth, 'Clearing Auth');
}

/**
 * Does what "Sign in with Google" does in the browser, against the Auth emulator, and returns the
 * Firebase ID token the web app would send to the API.
 */
async function signInWithGoogle(email: string, name?: string): Promise<string> {
  const claims = { sub: `google-${email}`, email, email_verified: true, ...(name ? { name } : {}) };
  const response = await fetch(
    emulatorUrl(authHost, '/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-key'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri: 'http://localhost',
        returnSecureToken: true,
        postBody: `providerId=google.com&id_token=${encodeURIComponent(JSON.stringify(claims))}`,
      }),
    },
  );
  await expectOk(response, 'Signing in with the Auth emulator');
  const body = (await response.json()) as { idToken?: string };
  if (!body.idToken) throw new Error('The Auth emulator returned no ID token');
  return body.idToken;
}

describe('signing in against the Firebase emulators', () => {
  let app: Express;

  beforeAll(() => {
    if (!authHost || !firestoreHost) {
      throw new Error(
        'The Firebase emulators are not running. Use "npm run test:emulator" in the repository root, which starts them first.',
      );
    }
    const config = loadConfig({
      NODE_ENV: 'test',
      FIREBASE_PROJECT_ID: PROJECT_ID,
      ADMIN_EMAIL,
    });
    app = createApp(config, createFirebaseDeps(PROJECT_ID));
  });

  beforeEach(resetEmulators);

  const get = (path: string, token: string) =>
    request(app).get(path).set('Authorization', bearer(token));

  it('signs in the first admin and creates their record, even without a Google name', async () => {
    const token = await signInWithGoogle(ADMIN_EMAIL);

    const res = await get('/api/me', token);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ email: ADMIN_EMAIL, name: null, role: 'admin' });
    expect(res.body.permissions).toContain('users:manage');
  });

  it('copies the Google name on first sign-in', async () => {
    const token = await signInWithGoogle(ADMIN_EMAIL, 'Ada Admin');

    const res = await get('/api/me', token);

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Ada Admin');
  });

  it('keeps one record across sign-ins and remembers the last sign-in', async () => {
    const token = await signInWithGoogle(ADMIN_EMAIL);
    await get('/api/me', token);
    await get('/api/me', token);

    const list = await get('/api/users', token);

    expect(list.status).toBe(200);
    expect(list.body.users).toHaveLength(1);
    expect(list.body.users[0].uid).not.toBeNull();
    expect(list.body.users[0].lastLoginAt).not.toBeNull();
  });

  it('lets two first sign-ins arrive at the same moment', async () => {
    const token = await signInWithGoogle(ADMIN_EMAIL);

    const results = await Promise.all([get('/api/me', token), get('/api/me', token)]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    const list = await get('/api/users', token);
    expect(list.body.users).toHaveLength(1);
  });

  it('turns away an account that was never invited', async () => {
    const token = await signInWithGoogle('stranger@example.com');

    const res = await get('/api/me', token);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not_invited');
  });

  it('rejects a token that is not a Firebase ID token', async () => {
    const res = await get('/api/me', 'not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_token');
  });

  it('signs in an invited person with their role, and keeps admin pages closed to them', async () => {
    const adminToken = await signInWithGoogle(ADMIN_EMAIL);
    await get('/api/me', adminToken);

    const invite = await request(app)
      .post('/api/users')
      .set('Authorization', bearer(adminToken))
      .send({ email: 'Dev@Example.com', role: 'developer' });
    expect(invite.status).toBe(201);
    expect(invite.body.user.email).toBe('dev@example.com');

    const devToken = await signInWithGoogle('dev@example.com', 'Dee Veloper');
    const me = await get('/api/me', devToken);
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual({
      email: 'dev@example.com',
      name: 'Dee Veloper',
      role: 'developer',
    });

    const forbidden = await get('/api/users', devToken);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('forbidden');
  });

  it('cuts off a deactivated person on their very next request', async () => {
    const adminToken = await signInWithGoogle(ADMIN_EMAIL);
    await get('/api/me', adminToken);
    await request(app)
      .post('/api/users')
      .set('Authorization', bearer(adminToken))
      .send({ email: 'dev@example.com', role: 'developer' });
    const devToken = await signInWithGoogle('dev@example.com');
    expect((await get('/api/me', devToken)).status).toBe(200);

    const patch = await request(app)
      .patch('/api/users/dev%40example.com')
      .set('Authorization', bearer(adminToken))
      .send({ active: false });
    expect(patch.status).toBe(200);

    const after = await get('/api/me', devToken);
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe('account_disabled');
  });

  it('never leaves the dashboard without an active admin', async () => {
    const adminToken = await signInWithGoogle(ADMIN_EMAIL);
    await get('/api/me', adminToken);
    const demote = () =>
      request(app)
        .patch('/api/users/admin%40example.com')
        .set('Authorization', bearer(adminToken))
        .send({ role: 'growth' });

    const refused = await demote();
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('last_admin');

    await request(app)
      .post('/api/users')
      .set('Authorization', bearer(adminToken))
      .send({ email: 'second@example.com', role: 'admin' });

    const allowed = await demote();
    expect(allowed.status).toBe(200);
    expect(allowed.body.user.role).toBe('growth');
  });

  // The dashboard keeps its people in a collection called "users". When the Firebase project is
  // shared with an app that has a collection of the same name, that collection holds documents the
  // dashboard did not write: no role, no uid, and a Firestore timestamp where a date string is
  // expected. The dashboard must keep working, and must never let such a document sign anyone in.
  describe('when the project is shared with an app that has its own users collection', () => {
    async function addAppDocuments() {
      const users = getFirestore().collection('users');
      await users.add({
        email: 'reader@example.com',
        name: 'App Reader',
        createdAt: Timestamp.now(),
      });
      await users.add({ email: 'owner@example.com', role: 'admin' });
    }

    it('still lists the people the dashboard knows about', async () => {
      const adminToken = await signInWithGoogle(ADMIN_EMAIL);
      await get('/api/me', adminToken);
      await addAppDocuments();

      const list = await get('/api/users', adminToken);

      expect(list.status).toBe(200);
      expect(list.body.users.map((user: { email: string }) => user.email)).toEqual([ADMIN_EMAIL]);
    });

    it('still accepts an invitation, and lists it', async () => {
      const adminToken = await signInWithGoogle(ADMIN_EMAIL);
      await get('/api/me', adminToken);
      await addAppDocuments();

      const invite = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(adminToken))
        .send({ email: 'dev@example.com', role: 'developer' });
      const list = await get('/api/users', adminToken);

      expect(invite.status).toBe(201);
      expect(list.status).toBe(200);
      expect(list.body.users.map((user: { email: string }) => user.email)).toEqual([
        ADMIN_EMAIL,
        'dev@example.com',
      ]);
    });

    it('does not count an app document with an admin role as a dashboard admin', async () => {
      const adminToken = await signInWithGoogle(ADMIN_EMAIL);
      await get('/api/me', adminToken);
      await addAppDocuments();

      const refused = await request(app)
        .patch('/api/users/admin%40example.com')
        .set('Authorization', bearer(adminToken))
        .send({ role: 'growth' });

      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe('last_admin');
    });

    it('does not let an app document sign anyone in', async () => {
      const adminToken = await signInWithGoogle(ADMIN_EMAIL);
      await get('/api/me', adminToken);
      await addAppDocuments();

      for (const email of ['reader@example.com', 'owner@example.com']) {
        const token = await signInWithGoogle(email);
        const res = await get('/api/me', token);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('not_invited');
      }
    });
  });
});
