import { readErrorCode } from './databaseErrors';
import { isEmulatorProject } from './emulatorProject';

/** One line for the startup log. */
export interface SetupNote {
  level: 'info' | 'warn';
  message: string;
}

/**
 * Describes, from the environment alone, how the API will reach Firebase, and flags the usual
 * mistakes. It makes no network calls and prints no secrets, so the answer to "why can nobody sign
 * in?" is in the first lines of the log rather than only after a failed sign-in.
 */
export function describeFirebaseSetup(
  env: NodeJS.ProcessEnv,
  fileExists: (path: string) => boolean,
): SetupNote[] {
  const notes: SetupNote[] = [];
  const authEmulator = env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
  const firestoreEmulator = env.FIRESTORE_EMULATOR_HOST?.trim();
  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  const auth = authEmulator ? `the Auth emulator at ${authEmulator}` : 'Firebase Auth';
  const database = firestoreEmulator
    ? `the Firestore emulator at ${firestoreEmulator}`
    : 'Firestore in the real project';
  notes.push({
    level: 'info',
    message: `Firebase project ${env.FIREBASE_PROJECT_ID ?? '(not set)'}: sign-in uses ${auth}; people are stored in ${database}.`,
  });

  if (Boolean(authEmulator) !== Boolean(firestoreEmulator)) {
    notes.push({
      level: 'warn',
      message:
        'Only one of FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST is set. Set both to ' +
        'use the emulators, or neither to use a real Firebase project.',
    });
  }

  // Sign-ins made in the Auth emulator belong to the emulator's own project (a "demo-" id, D-023),
  // so the API's project id has to agree with it. A leftover emulator line, or an emulator project
  // id with the emulator lines removed, makes every sign-in fail with a project mismatch.
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (projectId && authEmulator && !isEmulatorProject(projectId)) {
    notes.push({
      level: 'warn',
      message:
        'FIREBASE_AUTH_EMULATOR_HOST is set, so people sign in through the local Firebase emulator, ' +
        'whose sign-ins belong to an emulator project ("npm run emulators" runs demo-growth), but ' +
        `FIREBASE_PROJECT_ID is ${projectId}. Signing in will fail with a "different Firebase ` +
        'project" error. To use the emulators, set FIREBASE_PROJECT_ID and VITE_FIREBASE_PROJECT_ID ' +
        'to demo-growth. To use the real project, remove FIREBASE_AUTH_EMULATOR_HOST, ' +
        'FIRESTORE_EMULATOR_HOST and VITE_FIREBASE_AUTH_EMULATOR_URL from .env.',
    });
  } else if (projectId && !authEmulator && isEmulatorProject(projectId)) {
    notes.push({
      level: 'warn',
      message:
        `FIREBASE_PROJECT_ID is ${projectId}, a name that only the local emulators use, but ` +
        'FIREBASE_AUTH_EMULATOR_HOST is not set, so the API will ask the real Firebase, which has ' +
        'no such project, and nobody can sign in. Add the emulator lines from the README (Option A), ' +
        'or set the id of your real Firebase project.',
    });
  }

  // The emulators need no credentials; a real Firestore does.
  if (!firestoreEmulator) {
    if (!keyFile) {
      notes.push({
        level: 'info',
        message:
          'GOOGLE_APPLICATION_CREDENTIALS is not set, so the API will look for application default ' +
          'credentials (gcloud login, or the runtime service account on Cloud Run). If there are ' +
          'none, signing in fails with a "Server setup problem" message.',
      });
    } else if (!fileExists(keyFile)) {
      notes.push({
        level: 'warn',
        message:
          `GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist: ${keyFile}. Use the ` +
          'absolute path of the service account key file: a relative path is read from the folder ' +
          'the API was started in (apps/api for "npm run dev"), and "~" is not expanded.',
      });
    } else {
      notes.push({
        level: 'info',
        message: 'Google credentials: using the key file named in GOOGLE_APPLICATION_CREDENTIALS.',
      });
    }
  }

  return notes;
}

/**
 * Explains an error thrown while the Admin SDK starts up, when it is a known setup problem, or
 * returns null. The SDK reads the key file named in GOOGLE_APPLICATION_CREDENTIALS right away, so
 * a wrong path or a file that is not a service account key stops the API from starting.
 */
export function describeStartupFailure(err: unknown): string | null {
  if (readErrorCode(err) === 'app/invalid-credential') {
    return (
      'The key file named in GOOGLE_APPLICATION_CREDENTIALS could not be used. Set it to the ' +
      'absolute path of a service account key, a .json file from the Firebase console (Project ' +
      'settings, Service accounts, Generate new private key), save .env and start the API again.'
    );
  }
  return null;
}
