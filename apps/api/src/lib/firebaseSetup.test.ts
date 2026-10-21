import { describe, expect, it } from 'vitest';
import { describeFirebaseSetup, describeStartupFailure } from './firebaseSetup';

const exists = () => true;
const missing = () => false;

const messages = (notes: ReturnType<typeof describeFirebaseSetup>) =>
  notes.map((note) => note.message).join('\n');

describe('describeFirebaseSetup', () => {
  it('describes the emulators and asks for no credentials', () => {
    const notes = describeFirebaseSetup(
      {
        FIREBASE_PROJECT_ID: 'demo-growth',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      },
      missing,
    );

    expect(notes.every((note) => note.level === 'info')).toBe(true);
    expect(messages(notes)).toContain('the Auth emulator at 127.0.0.1:9099');
    expect(messages(notes)).toContain('the Firestore emulator at 127.0.0.1:8080');
    expect(messages(notes)).not.toContain('GOOGLE_APPLICATION_CREDENTIALS');
  });

  it('warns when only one of the two emulators is configured', () => {
    const notes = describeFirebaseSetup(
      { FIREBASE_PROJECT_ID: 'demo-growth', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
      missing,
    );

    const warning = notes.find((note) => note.level === 'warn');
    expect(warning?.message).toContain('Only one of FIREBASE_AUTH_EMULATOR_HOST');
  });

  it('warns when the Auth emulator is on but the project id is a real one', () => {
    const notes = describeFirebaseSetup(
      {
        FIREBASE_PROJECT_ID: 'my-studio',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      },
      missing,
    );

    const warning = notes.find((note) => note.level === 'warn');
    expect(warning?.message).toContain('FIREBASE_AUTH_EMULATOR_HOST is set');
    expect(warning?.message).toContain('FIREBASE_PROJECT_ID is my-studio');
    expect(warning?.message).toContain('set FIREBASE_PROJECT_ID and VITE_FIREBASE_PROJECT_ID');
    expect(warning?.message).toContain('VITE_FIREBASE_AUTH_EMULATOR_URL');
  });

  it('warns when the project id is an emulator project but the Auth emulator is not set', () => {
    const notes = describeFirebaseSetup({ FIREBASE_PROJECT_ID: 'demo-growth' }, missing);

    const warning = notes.find((note) => note.level === 'warn');
    expect(warning?.message).toContain('FIREBASE_PROJECT_ID is demo-growth');
    expect(warning?.message).toContain('FIREBASE_AUTH_EMULATOR_HOST is not set');
  });

  it.each<[string, NodeJS.ProcessEnv]>([
    ['a real project without emulators', { FIREBASE_PROJECT_ID: 'my-studio' }],
    [
      'the emulators with an emulator project',
      {
        FIREBASE_PROJECT_ID: 'demo-growth',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      },
    ],
    ['no project id at all', {}],
  ])('does not warn about the project id for %s', (_name, env) => {
    const notes = describeFirebaseSetup(env, missing);

    expect(messages(notes)).not.toContain('FIREBASE_PROJECT_ID is');
  });

  it('explains what happens when no key file is set for a real project', () => {
    const notes = describeFirebaseSetup({ FIREBASE_PROJECT_ID: 'my-studio' }, missing);

    expect(notes.every((note) => note.level === 'info')).toBe(true);
    expect(messages(notes)).toContain('Firebase project my-studio');
    expect(messages(notes)).toContain('GOOGLE_APPLICATION_CREDENTIALS is not set');
    expect(messages(notes)).toContain('Server setup problem');
  });

  it('treats an empty key file setting as not set', () => {
    const notes = describeFirebaseSetup(
      { FIREBASE_PROJECT_ID: 'my-studio', GOOGLE_APPLICATION_CREDENTIALS: '   ' },
      missing,
    );

    expect(messages(notes)).toContain('GOOGLE_APPLICATION_CREDENTIALS is not set');
  });

  it('warns when the key file does not exist, and says to use an absolute path', () => {
    const notes = describeFirebaseSetup(
      { FIREBASE_PROJECT_ID: 'my-studio', GOOGLE_APPLICATION_CREDENTIALS: './key.json' },
      missing,
    );

    const warning = notes.find((note) => note.level === 'warn');
    expect(warning?.message).toContain('./key.json');
    expect(warning?.message).toContain('absolute path');
    expect(warning?.message).toContain(
      'relative path is read from the folder the API was started in',
    );
  });

  it('is calm when the key file exists, and does not print its path', () => {
    const notes = describeFirebaseSetup(
      { FIREBASE_PROJECT_ID: 'my-studio', GOOGLE_APPLICATION_CREDENTIALS: '/home/me/key.json' },
      exists,
    );

    expect(notes.every((note) => note.level === 'info')).toBe(true);
    expect(messages(notes)).toContain('using the key file');
    expect(messages(notes)).not.toContain('/home/me/key.json');
  });
});

describe('describeStartupFailure', () => {
  // The Admin SDK reports an unreadable or unusable key file with this code.
  const badKeyFile = Object.assign(
    new Error('Failed to read credentials from file /nowhere/key.json: Error: ENOENT'),
    { code: 'app/invalid-credential' },
  );

  it('explains a key file that cannot be used, and what to change', () => {
    const text = describeStartupFailure(badKeyFile);

    expect(text).toContain('GOOGLE_APPLICATION_CREDENTIALS');
    expect(text).toContain('absolute path');
  });

  it('does not repeat the original error, which names a path', () => {
    expect(describeStartupFailure(badKeyFile)).not.toContain('/nowhere/key.json');
  });

  it('leaves other startup errors alone', () => {
    expect(describeStartupFailure(new Error('boom'))).toBeNull();
    expect(describeStartupFailure(undefined)).toBeNull();
  });
});
