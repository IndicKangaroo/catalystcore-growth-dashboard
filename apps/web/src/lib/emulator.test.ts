import { describe, expect, it, vi } from 'vitest';
import { authEmulatorUrl } from './emulator';

describe('authEmulatorUrl', () => {
  it('is the address from the settings when one is set', () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', 'http://127.0.0.1:9099');

    expect(authEmulatorUrl()).toBe('http://127.0.0.1:9099');
  });

  it('is null when the setting is empty, as an empty line in .env gives', () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', '');

    expect(authEmulatorUrl()).toBeNull();
  });
});
