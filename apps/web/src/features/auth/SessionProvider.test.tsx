import { permissionsFor } from '@growth/shared';
import type { MeResponse } from '@growth/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../../lib/api';
import { isFirebaseConfigured, signOutUser, watchAuth } from '../../lib/firebase';
import { SessionProvider } from './SessionProvider';
import { useSession } from './session';

vi.mock('../../lib/firebase', () => ({
  isFirebaseConfigured: vi.fn(),
  watchAuth: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
  getIdToken: vi.fn(),
}));

// Keep the real ApiError class; only the network call is replaced.
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

const ADMIN_ME: MeResponse = {
  user: { email: 'admin@example.com', name: 'Ada Admin', role: 'admin' },
  permissions: permissionsFor('admin'),
};

const DEVELOPER_ME: MeResponse = {
  user: { email: 'dev@example.com', name: null, role: 'developer' },
  permissions: permissionsFor('developer'),
};

/** Shows what the provider decided, as text a test can read. */
function Probe() {
  const { state, can, signOut } = useSession();
  return (
    <div>
      <p data-testid="status">{state.status}</p>
      <p data-testid="detail">
        {state.status === 'denied' && `${state.code}: ${state.message}`}
        {state.status === 'error' && state.message}
        {state.status === 'ready' && `${state.user.email} (${state.user.role})`}
      </p>
      <p data-testid="can-manage-users">{String(can('users:manage'))}</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

function renderSession() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

const status = () => screen.getByTestId('status').textContent;

/**
 * Makes Firebase report this uid (or null) as soon as the provider starts listening. The returned
 * function reports a later change, the way Firebase does after signing out.
 */
function firebaseReports(uid: string | null) {
  let emit: (next: string | null) => void = () => undefined;
  vi.mocked(watchAuth).mockImplementation((callback) => {
    emit = callback;
    callback(uid);
    return () => undefined;
  });
  return (next: string | null) => emit(next);
}

describe('SessionProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
  });

  it('is not_configured without Firebase settings, and never calls Firebase or the API', () => {
    vi.mocked(isFirebaseConfigured).mockReturnValue(false);

    renderSession();

    expect(status()).toBe('not_configured');
    expect(watchAuth).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('stays loading until Firebase says who is signed in', () => {
    vi.mocked(watchAuth).mockImplementation(() => () => undefined);

    renderSession();

    expect(status()).toBe('loading');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('is signed_out when Firebase has no user, without calling the API', async () => {
    firebaseReports(null);

    renderSession();

    await waitFor(() => expect(status()).toBe('signed_out'));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('is ready with the role and permissions the API reports', async () => {
    firebaseReports('uid-1');
    vi.mocked(apiFetch).mockResolvedValue(ADMIN_ME);

    renderSession();

    await waitFor(() => expect(status()).toBe('ready'));
    expect(screen.getByTestId('detail').textContent).toBe('admin@example.com (admin)');
    expect(screen.getByTestId('can-manage-users').textContent).toBe('true');
    expect(apiFetch).toHaveBeenCalledWith('/api/me');
  });

  it('does not grant permissions the role lacks', async () => {
    firebaseReports('uid-2');
    vi.mocked(apiFetch).mockResolvedValue(DEVELOPER_ME);

    renderSession();

    await waitFor(() => expect(status()).toBe('ready'));
    expect(screen.getByTestId('can-manage-users').textContent).toBe('false');
  });

  it('is denied, with the API message, when the person has not been invited', async () => {
    firebaseReports('uid-3');
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(403, 'not_invited', 'This Google account has not been invited.'),
    );

    renderSession();

    await waitFor(() => expect(status()).toBe('denied'));
    expect(screen.getByTestId('detail').textContent).toBe(
      'not_invited: This Google account has not been invited.',
    );
    expect(screen.getByTestId('can-manage-users').textContent).toBe('false');
  });

  it('reports other API failures as an error rather than a denial', async () => {
    firebaseReports('uid-4');
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(503, 'auth_not_configured', 'Sign-in is not set up on the server.'),
    );

    renderSession();

    await waitFor(() => expect(status()).toBe('error'));
    expect(screen.getByTestId('detail').textContent).toBe('Sign-in is not set up on the server.');
  });

  it('reports a network failure as an error', async () => {
    firebaseReports('uid-5');
    vi.mocked(apiFetch).mockRejectedValue(new TypeError('Failed to fetch'));

    renderSession();

    await waitFor(() => expect(status()).toBe('error'));
    expect(screen.getByTestId('detail').textContent).toBe('Failed to fetch');
  });

  it('signs out through Firebase and forgets the cached session', async () => {
    const reportAuthChange = firebaseReports('uid-1');
    vi.mocked(apiFetch).mockResolvedValue(ADMIN_ME);
    vi.mocked(signOutUser).mockImplementation(() => {
      reportAuthChange(null);
      return Promise.resolve();
    });
    const { queryClient } = renderSession();
    await waitFor(() => expect(status()).toBe('ready'));
    expect(queryClient.getQueryData(['me', 'uid-1'])).toEqual(ADMIN_ME);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(status()).toBe('signed_out'));
    expect(signOutUser).toHaveBeenCalledTimes(1);
    // Nothing from this person's session may be shown to whoever signs in next.
    await waitFor(() => expect(queryClient.getQueryData(['me', 'uid-1'])).toBeUndefined());
  });
});
