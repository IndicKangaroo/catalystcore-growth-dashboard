import type { InviteUserInput, UpdateUserInput, UserRecord } from '@growth/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeUserRecord, readyState, renderWithSession } from '../../test/helpers';
import UsersPage from './UsersPage';

// The real apiFetch runs against a fake fetch below; only the sign-in token is faked.
vi.mock('../../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue('test-token') }));

interface Failure {
  status: number;
  code: string;
  message: string;
}

interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

function reply(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function errorReply({ status, code, message }: Failure) {
  return reply(status, { error: { code, message } });
}

/**
 * A fake users API backed by a list in memory, so the page can be exercised end to end. Returns
 * the requests it received. `failures` makes one kind of request fail the way the real API would.
 */
function stubUsersApi(
  initial: UserRecord[],
  failures: { list?: Failure; invite?: Failure; update?: Failure } = {},
) {
  let users = [...initial];
  const requests: RecordedRequest[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      requests.push({ method, path, body });

      if (method === 'POST' && path === '/api/users') {
        if (failures.invite) return errorReply(failures.invite);
        const input = body as InviteUserInput;
        const created = makeUserRecord({ email: input.email, role: input.role });
        users = [...users, created];
        return reply(201, { user: created });
      }

      if (method === 'PATCH' && path.startsWith('/api/users/')) {
        if (failures.update) return errorReply(failures.update);
        const email = decodeURIComponent(path.slice('/api/users/'.length));
        const patch = body as UpdateUserInput;
        users = users.map((user) =>
          user.email === email
            ? { ...user, role: patch.role ?? user.role, active: patch.active ?? user.active }
            : user,
        );
        return reply(200, { user: users.find((user) => user.email === email) });
      }

      if (failures.list) return errorReply(failures.list);
      return reply(200, { users });
    }),
  );

  return requests;
}

const ADMIN = makeUserRecord({ email: 'admin@example.com', name: 'Ada Admin', role: 'admin' });
const DEVELOPER = makeUserRecord({ email: 'dev@example.com', role: 'developer' });

function renderUsersPage() {
  return renderWithSession(<UsersPage />, { state: readyState('admin', 'admin@example.com') });
}

const developerRow = () => screen.getByRole('row', { name: /dev@example\.com/ });

describe('UsersPage', () => {
  it('lists people, marks the signed-in admin, and protects their own access', async () => {
    stubUsersApi([ADMIN, { ...DEVELOPER, active: false }]);
    renderUsersPage();

    expect(await screen.findByText('admin@example.com (you)')).toBeInTheDocument();

    const ownRow = screen.getByRole('row', { name: /admin@example\.com/ });
    expect(within(ownRow).getByLabelText('Role for admin@example.com')).toBeDisabled();
    expect(within(ownRow).getByRole('button', { name: 'Deactivate' })).toBeDisabled();

    const otherRow = developerRow();
    expect(within(otherRow).getByText('Deactivated')).toBeInTheDocument();
    expect(within(otherRow).getByText('Never')).toBeInTheDocument();
    expect(within(otherRow).getByLabelText('Role for dev@example.com')).toBeEnabled();
    expect(within(otherRow).getByRole('button', { name: 'Reactivate' })).toBeEnabled();
  });

  it('invites a person with the chosen role, then shows them in the list', async () => {
    const requests = stubUsersApi([ADMIN]);
    renderUsersPage();
    await screen.findByText('admin@example.com (you)');

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'new.person@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'developer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));

    expect(await screen.findByText('new.person@example.com')).toBeInTheDocument();
    expect(requests).toContainEqual({
      method: 'POST',
      path: '/api/users',
      body: { email: 'new.person@example.com', role: 'developer' },
    });
    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveValue(''));
  });

  it('changes a role through the API and shows the new role', async () => {
    const requests = stubUsersApi([ADMIN, DEVELOPER]);
    renderUsersPage();

    fireEvent.change(await screen.findByLabelText('Role for dev@example.com'), {
      target: { value: 'growth' },
    });

    await waitFor(() =>
      expect(screen.getByLabelText('Role for dev@example.com')).toHaveValue('growth'),
    );
    expect(requests).toContainEqual({
      method: 'PATCH',
      path: '/api/users/dev%40example.com',
      body: { role: 'growth' },
    });
  });

  it('deactivates a person and then lets an admin reactivate them', async () => {
    const requests = stubUsersApi([ADMIN, DEVELOPER]);
    renderUsersPage();
    await screen.findByText('dev@example.com');

    fireEvent.click(within(developerRow()).getByRole('button', { name: 'Deactivate' }));
    expect(await within(developerRow()).findByText('Deactivated')).toBeInTheDocument();

    // The buttons stay disabled until the refresh after the change has finished.
    await waitFor(() =>
      expect(within(developerRow()).getByRole('button', { name: 'Reactivate' })).toBeEnabled(),
    );
    fireEvent.click(within(developerRow()).getByRole('button', { name: 'Reactivate' }));
    expect(await within(developerRow()).findByText('Active')).toBeInTheDocument();

    const patches = requests.filter((request) => request.method === 'PATCH');
    expect(patches.map((request) => request.body)).toEqual([{ active: false }, { active: true }]);
  });

  it("shows the server's reason when a change is refused", async () => {
    stubUsersApi([ADMIN, DEVELOPER], {
      update: { status: 404, code: 'user_not_found', message: 'That person no longer exists.' },
    });
    renderUsersPage();

    fireEvent.change(await screen.findByLabelText('Role for dev@example.com'), {
      target: { value: 'growth' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('That person no longer exists.');
  });

  it('shows why an invitation was refused and keeps what was typed', async () => {
    stubUsersApi([ADMIN], {
      invite: { status: 409, code: 'user_exists', message: 'That person already has access.' },
    });
    renderUsersPage();
    await screen.findByText('admin@example.com (you)');

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That person already has access.');
    expect(screen.getByLabelText('Email address')).toHaveValue('admin@example.com');
  });

  it('clears an earlier error once the next action starts', async () => {
    stubUsersApi([ADMIN, DEVELOPER], {
      invite: { status: 409, code: 'user_exists', message: 'That person already has access.' },
    });
    renderUsersPage();
    await screen.findByText('dev@example.com');

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'dev@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Role for dev@example.com'), {
      target: { value: 'growth' },
    });

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows an error when the list cannot be loaded', async () => {
    stubUsersApi([], {
      list: { status: 500, code: 'internal_error', message: 'Could not load users.' },
    });
    renderUsersPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load users.');
  });
});
