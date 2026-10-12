import type { Auth } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Firebase SDK is replaced, so no real app or network is involved.
vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: 'fake-app' })),
}));

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(() => ({ currentUser: null })),
  GoogleAuthProvider: class GoogleAuthProvider {},
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

/**
 * Loads a fresh copy of the module under test together with the mocked SDK, so the cached auth
 * instance never leaks between tests. The imports are sequential so both sides share one mock.
 */
async function load() {
  vi.resetModules();
  const firebase = await import('./firebase');
  const app = await import('firebase/app');
  const auth = await import('firebase/auth');
  return { firebase, app, auth };
}

/** A developer's own .env may define these, so every test sets the ones it relies on. */
function stubSettings(apiKey: string, projectId: string) {
  vi.stubEnv('VITE_FIREBASE_API_KEY', apiKey);
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', projectId);
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '');
  vi.stubEnv('VITE_FIREBASE_APP_ID', '');
  vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', '');
}

/** A stand-in for the SDK's Auth object, with only what the code under test reads. */
function fakeAuth(currentUser: { getIdToken: () => Promise<string> } | null = null): Auth {
  return { currentUser } as unknown as Auth;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isFirebaseConfigured', () => {
  it.each<[string, string, boolean]>([
    ['', '', false],
    ['some-key', '', false],
    ['', 'demo-growth', false],
    ['some-key', 'demo-growth', true],
  ])('with API key %j and project id %j it is %s', async (apiKey, projectId, expected) => {
    stubSettings(apiKey, projectId);
    const { firebase } = await load();

    expect(firebase.isFirebaseConfigured()).toBe(expected);
  });
});

describe('without Firebase settings', () => {
  it('has no auth instance and never touches the SDK', async () => {
    stubSettings('', '');
    const { firebase, app } = await load();

    expect(firebase.getFirebaseAuth()).toBeNull();
    expect(app.initializeApp).not.toHaveBeenCalled();
  });

  it('reports signed out straight away and returns a harmless unsubscribe', async () => {
    stubSettings('', '');
    const { firebase } = await load();
    const callback = vi.fn();

    const stop = firebase.watchAuth(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
    expect(() => stop()).not.toThrow();
  });

  it('has no ID token', async () => {
    stubSettings('', '');
    const { firebase } = await load();

    await expect(firebase.getIdToken()).resolves.toBeNull();
  });

  it('refuses to start Google sign-in', async () => {
    stubSettings('', '');
    const { firebase } = await load();

    await expect(firebase.signInWithGoogle()).rejects.toThrow('Firebase is not configured');
  });

  it('signs out without error', async () => {
    stubSettings('', '');
    const { firebase, auth } = await load();

    await expect(firebase.signOutUser()).resolves.toBeUndefined();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe('with Firebase settings', () => {
  it('starts the app once, using the project id for the auth domain by default', async () => {
    stubSettings('some-key', 'demo-growth');
    const { firebase, app, auth } = await load();

    const first = firebase.getFirebaseAuth();
    const second = firebase.getFirebaseAuth();

    expect(app.initializeApp).toHaveBeenCalledTimes(1);
    expect(app.initializeApp).toHaveBeenCalledWith({
      apiKey: 'some-key',
      authDomain: 'demo-growth.firebaseapp.com',
      projectId: 'demo-growth',
      appId: undefined,
    });
    expect(second).toBe(first);
    expect(auth.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('uses the auth domain and app id when they are set', async () => {
    stubSettings('some-key', 'demo-growth');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'login.example.com');
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc');
    const { firebase, app } = await load();

    firebase.getFirebaseAuth();

    expect(app.initializeApp).toHaveBeenCalledWith({
      apiKey: 'some-key',
      authDomain: 'login.example.com',
      projectId: 'demo-growth',
      appId: '1:123:web:abc',
    });
  });

  it('connects to the Auth emulator when its URL is set', async () => {
    stubSettings('some-key', 'demo-growth');
    vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', 'http://127.0.0.1:9099');
    const { firebase, auth } = await load();
    const fake = fakeAuth();
    vi.mocked(auth.getAuth).mockReturnValueOnce(fake);

    const result = firebase.getFirebaseAuth();

    expect(result).toBe(fake);
    expect(auth.connectAuthEmulator).toHaveBeenCalledWith(fake, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
  });

  it('gives the signed-in person a fresh ID token', async () => {
    stubSettings('some-key', 'demo-growth');
    const { firebase, auth } = await load();
    vi.mocked(auth.getAuth).mockReturnValueOnce(
      fakeAuth({ getIdToken: () => Promise.resolve('id-token-abc') }),
    );

    await expect(firebase.getIdToken()).resolves.toBe('id-token-abc');
  });

  it('has no ID token when nobody is signed in', async () => {
    stubSettings('some-key', 'demo-growth');
    const { firebase } = await load();

    await expect(firebase.getIdToken()).resolves.toBeNull();
  });

  it('reports the uid when sign-in state changes, and returns the SDK unsubscribe', async () => {
    stubSettings('some-key', 'demo-growth');
    const { firebase, auth } = await load();
    const unsubscribe = vi.fn();
    const listener = (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
      callback({ uid: 'uid-9' });
      callback(null);
      return unsubscribe;
    };
    // The SDK's own signature is wider than what the code under test uses.
    vi.mocked(auth.onAuthStateChanged).mockImplementation(listener as never);
    const seen: (string | null)[] = [];

    const stop = firebase.watchAuth((uid) => seen.push(uid));

    expect(seen).toEqual(['uid-9', null]);
    expect(stop).toBe(unsubscribe);
  });

  it('opens the Google sign-in pop-up', async () => {
    stubSettings('some-key', 'demo-growth');
    const { firebase, auth } = await load();
    const fake = fakeAuth();
    vi.mocked(auth.getAuth).mockReturnValueOnce(fake);

    await firebase.signInWithGoogle();

    expect(auth.signInWithPopup).toHaveBeenCalledWith(fake, expect.any(auth.GoogleAuthProvider));
  });

  it('signs out through the SDK', async () => {
    stubSettings('some-key', 'demo-growth');
    const { firebase, auth } = await load();
    const fake = fakeAuth();
    vi.mocked(auth.getAuth).mockReturnValueOnce(fake);

    await firebase.signOutUser();

    expect(auth.signOut).toHaveBeenCalledWith(fake);
  });
});
