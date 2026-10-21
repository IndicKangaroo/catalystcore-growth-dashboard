import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { stubApi } from '../test/api';
import { readyState, renderWithSession } from '../test/helpers';
import { TopBar } from './TopBar';

// Every request goes through the real apiFetch; only the sign-in token is faked.
vi.mock('../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

function renderBar() {
  stubApi({ '/api/health': { body: { status: 'ok', provider: 'ga4' } } });
  return renderWithSession(<TopBar pageName="Overview" showRange={false} />, {
    state: readyState(),
  });
}

describe('TopBar', () => {
  it('says "Local emulator" when sign-in is set up to use the Firebase emulator', () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', 'http://127.0.0.1:9099');

    renderBar();

    expect(within(screen.getByRole('banner')).getByText('Local emulator')).toBeInTheDocument();
  });

  it('does not mention an emulator when sign-in goes to Google', () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', '');

    renderBar();

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.queryByText('Local emulator')).not.toBeInTheDocument();
  });
});
