import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { readyState, renderWithSession } from '../../test/helpers';
import { RequirePermission, RequireSignedIn, SessionGate } from './guards';
import type { SessionState } from './session';

describe('SessionGate', () => {
  function renderGate(state: SessionState) {
    return renderWithSession(
      <Routes>
        <Route element={<SessionGate />}>
          <Route index element={<p>Inside the app</p>} />
        </Route>
      </Routes>,
      { state },
    );
  }

  it('shows a loading message while the session is being checked', () => {
    renderGate({ status: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session…');
    expect(screen.queryByText('Inside the app')).not.toBeInTheDocument();
  });

  it('explains why access is denied and lets the person sign out', () => {
    const { session } = renderGate({
      status: 'denied',
      code: 'not_invited',
      message: 'This Google account has not been invited.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This Google account has not been invited.',
    );
    expect(screen.queryByText('Inside the app')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(session.signOut).toHaveBeenCalledTimes(1);
  });

  it('shows API failures with a way to retry or sign out', () => {
    renderGate({ status: 'error', message: 'The server is not reachable.' });

    expect(screen.getByRole('alert')).toHaveTextContent('The server is not reachable.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('Inside the app')).not.toBeInTheDocument();
  });

  it.each<SessionState>([
    { status: 'signed_out' },
    { status: 'not_configured' },
    readyState('growth'),
  ])('lets the page render when the session is $status', (state) => {
    renderGate(state);

    expect(screen.getByText('Inside the app')).toBeInTheDocument();
  });
});

describe('RequireSignedIn', () => {
  function LoginStub() {
    const location = useLocation();
    const from = (location.state as { from?: string } | null)?.from ?? 'nowhere';
    return <p>{`Login page, came from ${from}`}</p>;
  }

  function renderGuarded(state: SessionState, route: string) {
    return renderWithSession(
      <Routes>
        <Route path="/login" element={<LoginStub />} />
        <Route element={<RequireSignedIn />}>
          <Route path="/reports" element={<p>Reports page</p>} />
        </Route>
      </Routes>,
      { state, route },
    );
  }

  it('sends signed-out visitors to the login page and remembers where they were going', () => {
    renderGuarded({ status: 'signed_out' }, '/reports');

    expect(screen.getByText('Login page, came from /reports')).toBeInTheDocument();
    expect(screen.queryByText('Reports page')).not.toBeInTheDocument();
  });

  it('also sends people to the login page when sign-in is not configured', () => {
    renderGuarded({ status: 'not_configured' }, '/reports');

    expect(screen.getByText('Login page, came from /reports')).toBeInTheDocument();
  });

  it('lets signed-in people through', () => {
    renderGuarded(readyState(), '/reports');

    expect(screen.getByText('Reports page')).toBeInTheDocument();
  });
});

describe('RequirePermission', () => {
  function renderProtected(state: SessionState) {
    return renderWithSession(
      <RequirePermission permission="users:manage">
        <p>Admin-only page</p>
      </RequirePermission>,
      { state },
    );
  }

  it('shows the page to a role that has the permission', () => {
    renderProtected(readyState('admin'));

    expect(screen.getByText('Admin-only page')).toBeInTheDocument();
  });

  it.each(['growth', 'developer'] as const)('refuses the page for the %s role', (role) => {
    renderProtected(readyState(role));

    expect(screen.getByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
    expect(screen.queryByText('Admin-only page')).not.toBeInTheDocument();
  });
});
