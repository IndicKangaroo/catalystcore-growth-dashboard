import { getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createFirestoreAppRepository } from '../apps/firestoreRepository';
import type { TokenVerifier } from '../auth/types';
import type { FirebaseDeps } from '../deps';
import { createFirestoreSettingsRepository } from '../settings/firestoreRepository';
import { createFirestoreUserRepository } from '../users/firestoreRepository';

function createVerifier(app: App): TokenVerifier {
  const auth = getAuth(app);
  return {
    async verify(idToken) {
      const decoded = await auth.verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.email_verified === true,
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
      };
    },
  };
}

/**
 * Wires the real Firebase Admin SDK. Credentials come from the environment: a key file named in
 * GOOGLE_APPLICATION_CREDENTIALS during local development, the runtime service account on Cloud
 * Run, or none at all against the emulators (FIRESTORE_EMULATOR_HOST and
 * FIREBASE_AUTH_EMULATOR_HOST are picked up by the SDK automatically).
 */
export function createFirebaseDeps(projectId: string): FirebaseDeps {
  const app = getApps()[0] ?? initializeApp({ projectId });
  const db = getFirestore(app);
  return {
    verifier: createVerifier(app),
    users: createFirestoreUserRepository(db),
    apps: createFirestoreAppRepository(db),
    settings: createFirestoreSettingsRepository(db),
  };
}
