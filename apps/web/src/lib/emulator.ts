/**
 * The address of the Firebase Auth emulator when the app is set up to sign in there, otherwise
 * null. Read at the moment of asking, and kept apart from lib/firebase.ts so a screen can ask
 * without loading the Firebase SDK. An empty line in .env counts as not set, hence || rather
 * than ??.
 */
export function authEmulatorUrl(): string | null {
  return import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || null;
}
