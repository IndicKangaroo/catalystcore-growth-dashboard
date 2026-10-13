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
