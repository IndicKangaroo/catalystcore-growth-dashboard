import { readErrorCode } from './databaseErrors';

/**
 * Why checking a Firebase ID token failed. Usually the token is bad or has expired and the person
 * signs in again. Two causes are setup problems that signing in again never fixes: the sign-in
 * service cannot be reached, or the token belongs to a different Firebase project than the API.
 */
export type TokenProblem = 'invalid' | 'wrong_project' | 'service_unavailable';

// Failures of the sign-in service itself (the network, the emulator), as opposed to a bad token.
const SERVICE_FAILURE_CODES = new Set([
  'auth/internal-error',
  'app/network-error',
  'app/network-timeout',
]);

export function classifyTokenError(err: unknown): TokenProblem {
  const code = readErrorCode(err);
  if (typeof code === 'string' && SERVICE_FAILURE_CODES.has(code)) return 'service_unavailable';
  // When a token belongs to another project the SDK says so in the audience or issuer check,
  // naming both projects.
  if (err instanceof Error && /incorrect "(aud|iss)"/.test(err.message)) return 'wrong_project';
  return 'invalid';
}

/** The two Firebase projects an ID token check compared, as far as the SDK's error names them. */
export interface ProjectMismatch {
  /** The project the API checks tokens for. */
  expected: string | undefined;
  /** The project the token was issued for, which is where the person signed in. */
  actual: string | undefined;
}

const ISSUER_PREFIX = 'https://securetoken.google.com/';

// A project id is a public identifier, but these names come out of an error text, and the token's
// side of it comes from the caller. Only plain letters, digits and a few separators are passed on.
const PLAIN_NAME = /^[\w .:-]{1,64}$/;

function plainProjectName(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const name = value.startsWith(ISSUER_PREFIX) ? value.slice(ISSUER_PREFIX.length) : value;
  return name !== 'undefined' && PLAIN_NAME.test(name) ? name : undefined;
}

/**
 * Reads which project the API expected and which one the token came from out of the SDK's
 * audience or issuer error: `... Expected "a" but got "b".` Either one is undefined when the text
 * does not name it or names something that is not a plain project id.
 */
export function readProjectMismatch(err: unknown): ProjectMismatch {
  const match =
    err instanceof Error ? /Expected "([^"]*)" but got "([^"]*)"/.exec(err.message) : null;
  return { expected: plainProjectName(match?.[1]), actual: plainProjectName(match?.[2]) };
}

/**
 * What to tell a person whose sign-in went to another Firebase project than the API's. It names
 * both projects when it can. Two matching project id settings do not prevent this: the project a
 * web sign-in goes to is the one the web API key belongs to, and a browser can still hold a
 * sign-in from an earlier setup.
 */
export function projectMismatchMessage({ expected, actual }: ProjectMismatch): string {
  const found =
    expected !== undefined && actual !== undefined
      ? `you signed in to the Firebase project "${actual}", but the API is set up for "${expected}".`
      : 'you signed in to a different Firebase project than the one the API uses.';
  return (
    `Server setup problem: ${found} The project you sign in to is the one that ` +
    'VITE_FIREBASE_API_KEY belongs to, and the API uses FIREBASE_PROJECT_ID. In .env, make ' +
    'VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID come from the same ' +
    'Firebase project, restart "npm run dev", then press Sign out and sign in again.'
  );
}
