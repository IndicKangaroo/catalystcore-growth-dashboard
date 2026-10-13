/**
 * Recognises the failures people meet on first setup, when the API cannot use Firestore: no Google
 * credentials, rejected or under-privileged credentials, a project without a database, or an
 * emulator that is not running. The API answers these with a clear 503 instead of a bare
 * "Something went wrong", and the original error goes to the log.
 */
export type DatabaseProblem =
  | 'no_credentials'
  | 'credentials_rejected'
  | 'permission_denied'
  | 'no_database'
  | 'unreachable';

// gRPC status codes reported by the Firestore client.
const GRPC_DEADLINE_EXCEEDED = 4;
const GRPC_NOT_FOUND = 5;
const GRPC_PERMISSION_DENIED = 7;
const GRPC_UNAVAILABLE = 14;
const GRPC_UNAUTHENTICATED = 16;

/** The `code` property of an error, when it is a number or a string. */
export function readErrorCode(err: unknown): number | string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const code = err.code;
  return typeof code === 'number' || typeof code === 'string' ? code : undefined;
}

export function classifyDatabaseError(err: unknown): DatabaseProblem | null {
  if (!(err instanceof Error)) return null;
  const message = err.message;
  const code = readErrorCode(err);

  if (message.includes('Could not load the default credentials')) return 'no_credentials';
  if (/invalid_grant|invalid_rapt|reauth related error/i.test(message)) {
    return 'credentials_rejected';
  }
  if (code === 'app/invalid-credential' || code === GRPC_UNAUTHENTICATED) {
    return 'credentials_rejected';
  }
  if (code === GRPC_PERMISSION_DENIED) return 'permission_denied';
  // NOT_FOUND also means "no such document" for some calls, so require the database to be named.
  if (code === GRPC_NOT_FOUND && /database/i.test(message)) return 'no_database';
  if (code === GRPC_UNAVAILABLE || code === GRPC_DEADLINE_EXCEEDED) return 'unreachable';
  return null;
}

/**
 * What the person sees. These are setup problems, so the text says what to change. Nothing here
 * is secret: it names settings, not values.
 */
export function describeDatabaseProblem(problem: DatabaseProblem): string {
  switch (problem) {
    case 'no_credentials':
      return (
        'Server setup problem: the API has no Google credentials to reach Firestore. Set ' +
        'GOOGLE_APPLICATION_CREDENTIALS in .env to the absolute path of a Firebase service ' +
        'account key file (or use the emulators), then restart the API. The README explains both.'
      );
    case 'credentials_rejected':
      return (
        "Server setup problem: Google rejected the API's credentials for Firestore. Create a new " +
        'service account key, or run "gcloud auth application-default login" again, then restart ' +
        'the API.'
      );
    case 'permission_denied':
      return (
        "Server setup problem: the API's Google credentials are not allowed to use Firestore in " +
        "this Firebase project. Use a key from this project's Firebase Admin SDK service " +
        'account, and check that the Cloud Firestore API is enabled.'
      );
    case 'no_database':
      return (
        'Server setup problem: this Firebase project has no Firestore database yet. Create one ' +
        'in the Firebase console under Firestore Database, then try again.'
      );
    case 'unreachable':
      return (
        'Server setup problem: the API cannot reach Firestore. If you are using the emulators, ' +
        'check that "npm run emulators" is running.'
      );
  }
}
