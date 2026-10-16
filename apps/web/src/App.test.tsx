import { ROLE_LABELS } from '@growth/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { SessionState } from './features/auth/session';
import { stubApi } from './test/api';
import { makeApp, makeStudio, makeUserRecord, readyState, renderWithSession } from './test/helpers';

// The screens reach the API through apiFetch, which asks Firebase for a token.
vi.mock('./lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

function stubBackend() {
  stubApi({
    '/api/health': { body: { status: 'ok', provider: 'seed' } },
    '/api/settings/studio': { body: makeStudio({ name: 'Orbit Studio' }) },
    '/api/apps': { body: { apps: [makeApp({ name: 'Alpha' })] } },
    '/api/users': {
      body: { users: [makeUserRecord({ email: 'admin@example.com', role: 'admin' })] },
    },
  });
}

// The frame around the screens loads the studio settings itself, so the test gives it none.
function renderAt(route: string, state: SessionState) {
  return renderWithSession(<App />, { state, route, studio: null });
}

describe('App routing', () => {
  beforeEach(() => {
    stubBackend();
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

  it('shows a signed-in person the overview inside the studio frame', async () => {
    renderAt('/', readyState('growth', 'grace@example.com', 'Grace'));

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/Welcome, Grace\./)).toBeInTheDocument();

    const bar = screen.getByRole('banner');
    expect(within(bar).getByText('Orbit Studio')).toBeInTheDocument();
    expect(within(bar).getByText('Grace')).toBeInTheDocument();
    expect(within(bar).getByText(ROLE_LABELS.growth)).toBeInTheDocument();
    // The API says its data is the generated demo data, and the top bar says so too.
    expect(await within(bar).findByText('Demo data')).toBeInTheDocument();
  });

  it('shows admins the Users link and page', async () => {
    renderAt('/settings/users', readyState('admin'));

    expect(await screen.findByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });

  it('hides the Users link from other roles and refuses the page', async () => {
    renderAt('/settings/users', readyState('developer'));

    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
    // The rest of the menu is there, so the missing link is a choice and not a late arrival.
    expect(screen.getByRole('link', { name: 'Apps' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('lets any signed-in role open the Apps screen from the menu', async () => {
    renderAt('/', readyState('developer'));

    fireEvent.click(await screen.findByRole('link', { name: 'Apps' }));

    expect(await screen.findByRole('heading', { name: 'Apps' })).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add app' })).not.toBeInTheDocument();
  });

  it('keeps the chosen date range when moving between screens', async () => {
    renderAt('/?range=7d', readyState('admin'));

    fireEvent.click(await screen.findByRole('link', { name: 'Apps' }));

    expect(await screen.findByRole('heading', { name: 'Apps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows a not-found page for unknown addresses inside the app', async () => {
    renderAt('/no/such/page', readyState());

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
