import { ROLE_LABELS } from '@growth/shared';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { SessionState } from './features/auth/session';
import { makeUserRecord, readyState, renderWithSession } from './test/helpers';

// UsersPage reaches the API through apiFetch, which asks Firebase for a token.
vi.mock('./lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      const body =
        path === '/api/users'
          ? { users: [makeUserRecord({ email: 'admin@example.com', role: 'admin' })] }
          : { status: 'ok', provider: 'seed' };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    }),
  );
}

function renderAt(route: string, state: SessionState) {
  return renderWithSession(<App />, { state, route });
}

describe('App routing', () => {
  beforeEach(() => {
    stubApi();
  });

  it('shows the login page to signed-out visitors', () => {
    renderAt('/login', { status: 'signed_out' });

    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
  });

  it('sends signed-out visitors from a private address to the login page', () => {
    renderAt('/settings/users', { status: 'signed_out' });

    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('shows setup help when sign-in is not configured', () => {
    renderAt('/', { status: 'not_configured' });

    expect(screen.getByRole('heading', { name: 'Sign-in is not set up yet' })).toBeInTheDocument();
  });

  it('shows a loading message while the session is being checked', () => {
    renderAt('/', { status: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session…');
  });

  it('welcomes a signed-in person and shows the data source the API reports', async () => {
    renderAt('/', readyState('growth', 'grace@example.com', 'Grace'));

    expect(screen.getByRole('heading', { name: 'Welcome, Grace' })).toBeInTheDocument();
    expect(screen.getByText(`grace@example.com · ${ROLE_LABELS.growth}`)).toBeInTheDocument();
    expect(await screen.findByText(/API connected \(data source: seed\)/)).toBeInTheDocument();
  });

  it('shows admins the Users link and page', async () => {
    renderAt('/settings/users', readyState('admin'));

    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });

  it('hides the Users link from other roles and refuses the page', () => {
    renderAt('/settings/users', readyState('developer'));

    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown addresses inside the app', () => {
    renderAt('/no/such/page', readyState());

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
