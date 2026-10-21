import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmulatorPill } from './EmulatorPill';

describe('EmulatorPill', () => {
  it('says "Local emulator" when sign-in is set up to use the Firebase emulator', () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', 'http://127.0.0.1:9099');

    render(<EmulatorPill />);

    expect(screen.getByText('Local emulator')).toBeInTheDocument();
    expect(screen.getByTitle(/not to Google/)).toBeInTheDocument();
  });

  it('shows nothing when sign-in goes to Google', () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', '');

    const { container } = render(<EmulatorPill />);

    expect(container).toBeEmptyDOMElement();
  });
});
