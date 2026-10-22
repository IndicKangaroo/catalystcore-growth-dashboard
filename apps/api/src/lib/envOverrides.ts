import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import type { SetupNote } from './firebaseSetup';

/**
 * A value set in the terminal, or in Windows' own settings, wins over the same name in `.env`: the
 * API loads `.env` without replacing anything that is already set. So "I changed `.env` and nothing
 * changes" is usually a setting from somewhere else, and nothing on screen says where it came from.
 * This finds those cases from the two sources alone, so the start-up log can name them.
 */

/** The settings that decide which Firebase project, which credentials and which data the API uses. */
const WATCHED = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GA4_SERVICE_ACCOUNT_KEY_FILE',
  'ANALYTICS_PROVIDER',
] as const;

/** Ids and host names may be shown; the location of a key file is not repeated (D-027, D-044). */
const SHOWN = new Set<string>([
  'FIREBASE_PROJECT_ID',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'ANALYTICS_PROVIDER',
]);

/** Leftovers of an emulator session: harmless looking, and the cause of "different project" errors. */
const EMULATOR_HOSTS = new Set<string>(['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']);

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const named = (name: string, value: string) => (SHOWN.has(name) ? `"${value}"` : 'another file');

const HOW_TO_REMOVE = (name: string) =>
  `To use what .env says, remove it from the terminal (PowerShell: Remove-Item Env:${name}; ` +
  `Command Prompt: set ${name}=) and, if it comes back in a new terminal, from Windows' ` +
  'environment variables, then restart "npm run dev".';

/**
 * Notes for the start-up log about settings whose value comes from outside `.env`. `env` is what
 * the API is running with; `file` is what `.env` says. A name with the same value in both, or one
 * that only the environment sets (production has no `.env`), is fine and gets no note.
 */
export function describeEnvOverrides(
  env: Record<string, string | undefined>,
  file: Record<string, string | undefined>,
): SetupNote[] {
  const notes: SetupNote[] = [];
  for (const name of WATCHED) {
    const used = clean(env[name]);
    const written = clean(file[name]);
    if (used === undefined) continue;

    if (written !== undefined && written !== used) {
      notes.push({
        level: 'warn',
        message:
          `${name} is ${named(name, used)} in the environment this API was started from (the ` +
          `terminal, or Windows' settings), and that wins over ${named(name, written)} in .env. ` +
          `The API is using ${named(name, used)}. ${HOW_TO_REMOVE(name)}`,
      });
    } else if (written === undefined && EMULATOR_HOSTS.has(name)) {
      notes.push({
        level: 'warn',
        message:
          `${name} is "${used}" in the environment this API was started from (the terminal, or ` +
          "Windows' settings), but .env does not ask for it, so the API talks to the local " +
          `emulator. ${HOW_TO_REMOVE(name)}`,
      });
    }
  }
  return notes;
}

/** What a `.env` file says, read the way the API's own loader reads it; empty if there is none. */
export function readDotEnv(path: string): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}
