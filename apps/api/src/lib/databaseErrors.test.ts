import { describe, expect, it } from 'vitest';
import { classifyDatabaseError, describeDatabaseProblem, readErrorCode } from './databaseErrors';
import type { DatabaseProblem } from './databaseErrors';

/** An error carrying a gRPC status code, the way the Firestore client reports failures. */
function grpcError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('classifyDatabaseError', () => {
  it('recognises missing Google credentials', () => {
    const err = new Error(
      'Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.',
    );
    expect(classifyDatabaseError(err)).toBe('no_credentials');
  });

  it('recognises credentials that Google rejects', () => {
    expect(
      classifyDatabaseError(new Error('invalid_grant: reauth related error (invalid_rapt)')),
    ).toBe('credentials_rejected');
    expect(
      classifyDatabaseError(grpcError(16, '16 UNAUTHENTICATED: Request had invalid credentials')),
    ).toBe('credentials_rejected');
    expect(
      classifyDatabaseError(
        Object.assign(new Error('failed to fetch a token'), { code: 'app/invalid-credential' }),
      ),
    ).toBe('credentials_rejected');
  });

  it('recognises a service account without access to Firestore', () => {
    expect(
      classifyDatabaseError(
        grpcError(7, '7 PERMISSION_DENIED: Missing or insufficient permissions.'),
      ),
    ).toBe('permission_denied');
  });

  it('recognises a project that has no Firestore database', () => {
    const err = grpcError(
      5,
      '5 NOT_FOUND: The database (default) does not exist for project demo.',
    );
    expect(classifyDatabaseError(err)).toBe('no_database');
  });

  it('does not mistake a missing document for a missing database', () => {
    expect(
      classifyDatabaseError(grpcError(5, '5 NOT_FOUND: No document to update: users/a')),
    ).toBeNull();
  });

  it('recognises an unreachable database', () => {
    const refused =
      '14 UNAVAILABLE: No connection established. Last error: connect ECONNREFUSED 127.0.0.1:8080';
    expect(classifyDatabaseError(grpcError(14, refused))).toBe('unreachable');
    expect(classifyDatabaseError(grpcError(4, '4 DEADLINE_EXCEEDED: Deadline exceeded'))).toBe(
      'unreachable',
    );
  });

  it('leaves unrelated errors alone', () => {
    expect(classifyDatabaseError(new Error('boom'))).toBeNull();
    expect(classifyDatabaseError(grpcError(3, '3 INVALID_ARGUMENT: bad value'))).toBeNull();
    expect(classifyDatabaseError('not an error object')).toBeNull();
    expect(classifyDatabaseError(undefined)).toBeNull();
  });
});

describe('describeDatabaseProblem', () => {
  const problems: DatabaseProblem[] = [
    'no_credentials',
    'credentials_rejected',
    'permission_denied',
    'no_database',
    'unreachable',
  ];

  it.each(problems)('says what to change for %s', (problem) => {
    const text = describeDatabaseProblem(problem);
    expect(text.startsWith('Server setup problem:')).toBe(true);
    expect(text.length).toBeGreaterThan(60);
  });

  it('points at the settings for missing credentials, without any secret value', () => {
    const text = describeDatabaseProblem('no_credentials');
    expect(text).toContain('GOOGLE_APPLICATION_CREDENTIALS');
    expect(text).toContain('emulators');
  });
});

describe('readErrorCode', () => {
  it('reads numeric and string codes', () => {
    expect(readErrorCode(grpcError(14, 'x'))).toBe(14);
    expect(readErrorCode(Object.assign(new Error('x'), { code: 'auth/internal-error' }))).toBe(
      'auth/internal-error',
    );
  });

  it('returns undefined when there is no usable code', () => {
    expect(readErrorCode(new Error('x'))).toBeUndefined();
    expect(readErrorCode(Object.assign(new Error('x'), { code: {} }))).toBeUndefined();
    expect(readErrorCode(null)).toBeUndefined();
    expect(readErrorCode('text')).toBeUndefined();
  });
});
