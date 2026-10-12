import { getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import type { Auth } from 'firebase/auth';

/** True when the VITE_FIREBASE_* settings are present. Without them the app shows setup help. */
export function isFirebaseConfigured(): boolean {
  const env = import.meta.env;
  return Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);
}

let cachedAuth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured()) return null;

  if (!cachedAuth) {
    const env = import.meta.env;
    const projectId = env.VITE_FIREBASE_PROJECT_ID;
    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: env.VITE_FIREBASE_API_KEY,
        // An empty value in .env counts as "not set", hence || rather than ??.
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
        projectId,
        appId: env.VITE_FIREBASE_APP_ID || undefined,
      });
    cachedAuth = getAuth(app);

    if (env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
      connectAuthEmulator(cachedAuth, env.VITE_FIREBASE_AUTH_EMULATOR_URL, {
        disableWarnings: true,
      });
    }
  }
  return cachedAuth;
}

/**
 * Reports the signed-in Firebase uid, or null when signed out. Fires once at startup with the
 * remembered session. Returns a function that stops listening.
 */
export function watchAuth(callback: (uid: string | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, (user) => callback(user ? user.uid : null));
}

export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured');
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) await signOut(auth);
}

/** A fresh ID token for the signed-in person, or null when nobody is signed in. */
export async function getIdToken(): Promise<string | null> {
  const user = getFirebaseAuth()?.currentUser;
  return user ? user.getIdToken() : null;
}
