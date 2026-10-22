import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeEnvOverrides, readDotEnv } from './envOverrides';

const messages = (notes: ReturnType<typeof describeEnvOverrides>) =>
  notes.map((note) => note.message).join('\n');

describe('describeEnvOverrides', () => {
  it('says nothing when the environment and .env agree', () => {
    const same = { FIREBASE_PROJECT_ID: 'my-project', ANALYTICS_PROVIDER: 'seed' };

    expect(describeEnvOverrides(same, same)).toEqual([]);
  });

  it('says nothing when there is no .env, as in production', () => {
    expect(describeEnvOverrides({ FIREBASE_PROJECT_ID: 'my-project' }, {})).toEqual([]);
  });

  it('names a project id from the terminal that wins over .env, and how to remove it', () => {
    const notes = describeEnvOverrides(
      { FIREBASE_PROJECT_ID: 'demo-growth' },
      { FIREBASE_PROJECT_ID: 'my-project' },
    );

    expect(notes).toHaveLength(1);
    expect(notes[0]?.level).toBe('warn');
    expect(messages(notes)).toContain('FIREBASE_PROJECT_ID is "demo-growth"');
    expect(messages(notes)).toContain('wins over "my-project" in .env');
    expect(messages(notes)).toContain('Remove-Item Env:FIREBASE_PROJECT_ID');
  });

  it('flags an emulator host that .env does not ask for', () => {
    const notes = describeEnvOverrides({ FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }, {});

    expect(messages(notes)).toContain('FIREBASE_AUTH_EMULATOR_HOST is "127.0.0.1:9099"');
    expect(messages(notes)).toContain('does not ask for it');
  });

  it('does not flag other settings that only the environment sets', () => {
    expect(describeEnvOverrides({ FIREBASE_PROJECT_ID: 'my-project' }, { PORT: '8787' })).toEqual(
      [],
    );
  });

  it('does not show where a key file is', () => {
    const notes = describeEnvOverrides(
      { GOOGLE_APPLICATION_CREDENTIALS: 'C:/other/secret-key.json' },
      { GOOGLE_APPLICATION_CREDENTIALS: 'C:/keys/real-key.json' },
    );

    expect(notes).toHaveLength(1);
    expect(messages(notes)).toContain('another file');
    expect(messages(notes)).not.toContain('secret-key');
    expect(messages(notes)).not.toContain('real-key');
  });

  it('treats an empty value in .env as not set', () => {
    expect(
      describeEnvOverrides({ FIREBASE_PROJECT_ID: 'my-project' }, { FIREBASE_PROJECT_ID: '' }),
    ).toEqual([]);
  });
});

describe('readDotEnv', () => {
  it('reads quoted values and Windows paths the way the API loads them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dotenv-'));
    try {
      const file = join(dir, '.env');
      writeFileSync(
        file,
        [
          'FIREBASE_PROJECT_ID="my-project"',
          'GOOGLE_APPLICATION_CREDENTIALS="C:\\keys\\admin.json"',
          '# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080',
        ].join('\n'),
      );

      expect(readDotEnv(file)).toEqual({
        FIREBASE_PROJECT_ID: 'my-project',
        GOOGLE_APPLICATION_CREDENTIALS: 'C:\\keys\\admin.json',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is empty when there is no file', () => {
    expect(readDotEnv(join(tmpdir(), 'no-such-folder', '.env'))).toEqual({});
  });
});
