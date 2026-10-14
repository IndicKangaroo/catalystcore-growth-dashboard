import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { readyState, renderWithSession } from '../../test/helpers';
import LoginPage from './LoginPage';
import type { SessionState } from './session';

type RouteEntry = NonNullable<ComponentProps<typeof MemoryRouter>['initialEntries']>[number];

function renderLogin(state: SessionState, route: RouteEntry = '/login') {
  return renderWithSession(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Home page</p>} />
      <Route path="/reports" element={<p>Reports page</p>} />
    </Routes>,
    { state, route },
  );
}

const signInButton = () => screen.getByRole('button', { name: 'Sign in with Google' });

describe('LoginPage', () => {
  it('shows setup help instead of a button when Firebase is not configured', () => {
    renderLogin({ status: 'not_configured' });

    expect(screen.getByRole('heading', { name: 'Sign-in is not set up yet' })).toBeInTheDocument();
    expect(screen.getByText('VITE_FIREBASE_API_KEY')).toBeInTheDocument();
    expect(screen.getByText('VITE_FIREBASE_PROJECT_ID')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument();
  });

  it('starts Google sign-in when the button is pressed', async () => {
    const { session } = renderLogin({ status: 'signed_out' });

    fireEvent.click(signInButton());

    expect(session.signIn).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(signInButton()).toBeEnabled());
  });

  it('disables the button while the Google window is open', () => {
    const { session } = renderLogin({ status: 'signed_out' });
    vi.mocked(session.signIn).mockReturnValue(new Promise<void>(() => undefined));

    fireEvent.click(signInButton());

    expect(screen.getByRole('button', { name: 'Opening Google…' })).toBeDisabled();
  });

  it.each([
    ['auth/popup-closed-by-user', 'The sign-in window was closed before it finished.'],
    ['auth/cancelled-popup-request', 'The sign-in window was closed before it finished.'],
    ['auth/popup-blocked', 'Your browser blocked the sign-in window.'],
    ['auth/network-request-failed', 'Network problem. Check your connection and try again.'],
    ['auth/network-request-failed', 'check that "npm run emulators" is running'],
    ['auth/web-storage-unsupported', 'Allow cookies and site data for this site'],
    ['auth/user-disabled', 'disabled in Firebase. Ask an admin.'],
    ['auth/too-many-requests', 'Too many attempts.'],
    ['auth/unauthorized-domain', 'Authorized domains'],
    ['auth/unauthorized-domain', 'http://localhost:5173 (not 127.0.0.1)'],
    ['auth/operation-not-allowed', 'Google sign-in is not turned on for this Firebase project.'],
    ['auth/configuration-not-found', 'press Get started, then enable Google.'],
    ['auth/invalid-api-key', 'Firebase rejected the web API key.'],
    ['auth/api-key-not-valid.-please-pass-a-valid-api-key.', 'Firebase rejected the web API key.'],
  ])('explains a %s failure in plain words (%#)', async (code, message) => {
    const { session } = renderLogin({ status: 'signed_out' });
    vi.mocked(session.signIn).mockRejectedValue(Object.assign(new Error('firebase'), { code }));

    fireEvent.click(signInButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await waitFor(() => expect(signInButton()).toBeEnabled());
  });

  it('names the code of a failure it does not know, so it can be looked up', async () => {
    const { session } = renderLogin({ status: 'signed_out' });
    vi.mocked(session.signIn).mockRejectedValue(
      Object.assign(new Error('firebase'), { code: 'auth/something-unexpected' }),
    );

    fireEvent.click(signInButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in failed (auth/something-unexpected). Try again.',
    );
  });

  it('keeps the message short when the failure has no code', async () => {
    const { session } = renderLogin({ status: 'signed_out' });
    vi.mocked(session.signIn).mockRejectedValue(new Error('boom'));

    fireEvent.click(signInButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in failed. Try again.');
  });

  it('sends a signed-in person on to the page they came from', () => {
    renderLogin(readyState(), { pathname: '/login', state: { from: '/reports' } });

    expect(screen.getByText('Reports page')).toBeInTheDocument();
  });

  it('sends a signed-in person home when there is no earlier page', () => {
    renderLogin(readyState());

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });
});
