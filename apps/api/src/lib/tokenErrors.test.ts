import { describe, expect, it } from 'vitest';
import { classifyTokenError, projectMismatchMessage, readProjectMismatch } from './tokenErrors';

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

describe('readProjectMismatch', () => {
  it('reads the expected and the actual project from an audience error', () => {
    const err = sdkError(
      'auth/argument-error',
      'Firebase ID token has incorrect "aud" (audience) claim. Expected "my-studio" but got "demo-growth". Make sure the ID token comes from the same Firebase project as the service account used to authenticate this SDK.',
    );
    expect(readProjectMismatch(err)).toEqual({ expected: 'my-studio', actual: 'demo-growth' });
  });

  it('reads them from an issuer error without the issuer address', () => {
    const err = sdkError(
      'auth/argument-error',
      'Firebase ID token has incorrect "iss" (issuer) claim. Expected "https://securetoken.google.com/my-studio" but got "https://securetoken.google.com/demo-growth".',
    );
    expect(readProjectMismatch(err)).toEqual({ expected: 'my-studio', actual: 'demo-growth' });
  });

  it('leaves out a name that is not a plain project id', () => {
    const tooLong = 'x'.repeat(65);
    const odd = (got: string) =>
      sdkError(
        'auth/argument-error',
        `incorrect "aud" claim. Expected "my-studio" but got "${got}".`,
      );

    expect(readProjectMismatch(odd('<script>alert(1)</script>'))).toEqual({
      expected: 'my-studio',
      actual: undefined,
    });
    expect(readProjectMismatch(odd('undefined')).actual).toBeUndefined();
    expect(readProjectMismatch(odd(''))).toEqual({ expected: 'my-studio', actual: undefined });
    expect(readProjectMismatch(odd(tooLong)).actual).toBeUndefined();
  });

  it('finds nothing when the error does not name the projects', () => {
    const none = { expected: undefined, actual: undefined };
    expect(readProjectMismatch(sdkError('auth/argument-error', 'incorrect "aud" claim.'))).toEqual(
      none,
    );
    expect(readProjectMismatch('boom')).toEqual(none);
    expect(readProjectMismatch(undefined)).toEqual(none);
  });
});

describe('projectMismatchMessage', () => {
  it('names the project the person signed in to and the one the API uses', () => {
    const message = projectMismatchMessage({ expected: 'my-studio', actual: 'demo-growth' });

    expect(message.startsWith('Server setup problem:')).toBe(true);
    expect(message).toContain('signed in to the Firebase project "demo-growth"');
    expect(message).toContain('the API is set up for "my-studio"');
  });

  it('points at the web API key as well as the two project id settings', () => {
    const message = projectMismatchMessage({ expected: 'my-studio', actual: 'demo-growth' });

    expect(message).toContain('VITE_FIREBASE_API_KEY');
    expect(message).toContain('VITE_FIREBASE_PROJECT_ID');
    expect(message).toContain('FIREBASE_PROJECT_ID');
    expect(message).toContain('restart "npm run dev"');
    expect(message).toContain('Sign out');
  });

  it('gives the general message when either project is unknown', () => {
    for (const projects of [
      { expected: undefined, actual: undefined },
      { expected: 'my-studio', actual: undefined },
      { expected: undefined, actual: 'demo-growth' },
    ]) {
      const message = projectMismatchMessage(projects);
      expect(message).toContain('a different Firebase project than the one the API uses');
      expect(message).not.toContain('"my-studio"');
      expect(message).not.toContain('"demo-growth"');
    }
  });
});
