import { ROLES, ROLE_LABELS, roleSchema } from '@growth/shared';
import type {
  InviteUserInput,
  Role,
  UpdateUserInput,
  UserResponse,
  UsersResponse,
} from '@growth/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { apiFetch } from '../../lib/api';
import { useSession } from '../auth/session';

const USERS_KEY = ['users'] as const;

const FIELD_CLASS =
  'rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-fg ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

function formatLastSignIn(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never';
}

/** Admin screen: invite people, change roles, deactivate or reactivate access. */
export default function UsersPage() {
  const { state } = useSession();
  const currentEmail = state.status === 'ready' ? state.user.email : '';
  const queryClient = useQueryClient();

  const users = useQuery({
    queryKey: USERS_KEY,
    queryFn: () => apiFetch<UsersResponse>('/api/users'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: USERS_KEY });

  const invite = useMutation({
    mutationFn: (input: InviteUserInput) =>
      apiFetch<UserResponse>('/api/users', { method: 'POST', body: input }),
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: ({ email, patch }: { email: string; patch: UpdateUserInput }) =>
      apiFetch<UserResponse>(`/api/users/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: refresh,
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('growth');

  // Starting one action clears the other's earlier error, so a stale message never lingers.
  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.reset();
    invite.mutate(
      { email: inviteEmail, role: inviteRole },
      { onSuccess: () => setInviteEmail('') },
    );
  }

  function changeUser(email: string, patch: UpdateUserInput) {
    invite.reset();
    update.mutate({ email, patch });
  }

  const errorMessage = invite.error?.message ?? update.error?.message ?? users.error?.message;

  return (
    <section>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-1 text-fg-muted">
        People can sign in with Google only after they are invited here.
      </p>

      <form onSubmit={handleInvite} className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="invite-email" className="text-sm font-medium">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            className={`${FIELD_CLASS} w-72`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="invite-role" className="text-sm font-medium">
            Role
          </label>
          <select
            id="invite-role"
            value={inviteRole}
            onChange={(event) => setInviteRole(roleSchema.parse(event.target.value))}
            className={FIELD_CLASS}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={invite.isPending}>
          Invite
        </Button>
      </form>
      <p className="mt-2 text-sm text-fg-muted">
        Use the exact email address of the person&apos;s Google account.
      </p>

      {errorMessage && (
        <p role="alert" className="mt-4 text-danger">
          {errorMessage}
        </p>
      )}

      {users.isPending && (
        <p role="status" className="mt-6 text-fg-muted">
          Loading users…
        </p>
      )}

      {users.data && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">People with access</caption>
            <thead>
              <tr className="text-fg-muted">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Email
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Name
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Role
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Status
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Last sign-in
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.users.map((user) => {
                const isSelf = user.email === currentEmail;
                return (
                  <tr key={user.email} className="border-t border-line">
                    <td className="py-2 pr-4">{isSelf ? `${user.email} (you)` : user.email}</td>
                    <td className="py-2 pr-4">{user.name ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <select
                        aria-label={`Role for ${user.email}`}
                        value={user.role}
                        disabled={isSelf || update.isPending}
                        title={isSelf ? "You can't change your own access" : undefined}
                        onChange={(event) =>
                          changeUser(user.email, { role: roleSchema.parse(event.target.value) })
                        }
                        className={FIELD_CLASS}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4">{user.active ? 'Active' : 'Deactivated'}</td>
                    <td className="py-2 pr-4">{formatLastSignIn(user.lastLoginAt)}</td>
                    <td className="py-2">
                      <Button
                        variant="secondary"
                        disabled={isSelf || update.isPending}
                        title={isSelf ? "You can't change your own access" : undefined}
                        onClick={() => changeUser(user.email, { active: !user.active })}
                      >
                        {user.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
