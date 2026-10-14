import { describe, expect, it } from 'vitest';
import { classifyTokenError } from './tokenErrors';

function sdkError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('classifyTokenError', () => {
  it.each(['auth/internal-error', 'app/network-error', 'app/network-timeout'])(
    'treats %s as the sign-in service being unavailable',
    (code) => {
      expect(classifyTokenError(sdkError(code, 'Error while making request'))).toBe(
        'service_unavailable',
      );
    },
  );

  it('recognises a token from another Firebase project by its audience', () => {
    const err = sdkError(
      'auth/argument-error',
      'Firebase ID token has incorrect "aud" (audience) claim. Expected "my-studio" but got "demo-growth". Make sure the ID token comes from the same Firebase project as the service account used to authenticate this SDK.',
    );
    expect(classifyTokenError(err)).toBe('wrong_project');
  });

  it('recognises a token from another Firebase project by its issuer', () => {
    const err = sdkError(
      'auth/argument-error',
      'Firebase ID token has incorrect "iss" (issuer) claim. Expected "https://securetoken.google.com/my-studio" but got "https://securetoken.google.com/demo-growth".',
    );
    expect(classifyTokenError(err)).toBe('wrong_project');
  });

  it.each([
    sdkError('auth/id-token-expired', 'Firebase ID token has expired.'),
    sdkError('auth/argument-error', 'Decoding Firebase ID token failed.'),
    sdkError('auth/user-not-found', 'There is no user record for this identifier.'),
    new Error('unknown test token'),
  ])('treats every other failure as an invalid token (%#)', (err) => {
    expect(classifyTokenError(err)).toBe('invalid');
  });

  it('treats a thrown non-error as an invalid token', () => {
    expect(classifyTokenError('boom')).toBe('invalid');
    expect(classifyTokenError(undefined)).toBe('invalid');
  });
});
