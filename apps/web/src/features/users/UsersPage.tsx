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
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { COMPACT_FIELD_CLASS, SelectField, TextField } from '../../components/fields';
import { apiFetch } from '../../lib/api';
import { useSession } from '../auth/session';

const USERS_KEY = ['users'] as const;

const HEADER_CELL = 'px-4 py-3';

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="People can sign in with Google only after they are invited here."
      />

      <Card className="p-5">
        <h2 className="text-base font-semibold text-fg">Invite a person</h2>
        <form onSubmit={handleInvite} className="mt-4 flex flex-wrap items-end gap-3">
          <TextField
            id="invite-email"
            label="Email address"
            type="email"
            required
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            className="w-72"
          />
          <SelectField
            id="invite-role"
            label="Role"
            value={inviteRole}
            onChange={(event) => setInviteRole(roleSchema.parse(event.target.value))}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </SelectField>
          <Button type="submit" disabled={invite.isPending}>
            Invite
          </Button>
        </form>
        <p className="mt-3 text-xs text-fg-subtle">
          Use the exact email address of the person&apos;s Google account.
        </p>
      </Card>

      {errorMessage && <Notice tone="danger">{errorMessage}</Notice>}

      {users.isPending && (
        <p role="status" className="text-fg-muted">
          Loading users…
        </p>
      )}

      {users.data && (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <caption className="sr-only">People with access</caption>
              <thead>
                <tr className="border-b border-line bg-canvas text-[11px] font-semibold tracking-[0.04em] text-fg-subtle uppercase">
                  <th scope="col" className={HEADER_CELL}>
                    Email
                  </th>
                  <th scope="col" className={HEADER_CELL}>
                    Name
                  </th>
                  <th scope="col" className={HEADER_CELL}>
                    Role
                  </th>
                  <th scope="col" className={HEADER_CELL}>
                    Status
                  </th>
                  <th scope="col" className={HEADER_CELL}>
                    Last sign-in
                  </th>
                  <th scope="col" className={HEADER_CELL}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.data.users.map((user) => {
                  const isSelf = user.email === currentEmail;
                  return (
                    <tr key={user.email}>
                      <td className="px-4 py-2.5 text-fg">
                        {isSelf ? `${user.email} (you)` : user.email}
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted">{user.name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <select
                          aria-label={`Role for ${user.email}`}
                          value={user.role}
                          disabled={isSelf || update.isPending}
                          title={isSelf ? "You can't change your own access" : undefined}
                          onChange={(event) =>
                            changeUser(user.email, { role: roleSchema.parse(event.target.value) })
                          }
                          className={`${COMPACT_FIELD_CLASS} min-w-36`}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <Chip tone={user.active ? 'ok' : 'neutral'} dot>
                          {user.active ? 'Active' : 'Deactivated'}
                        </Chip>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-fg-muted">
                        {formatLastSignIn(user.lastLoginAt)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
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
        </Card>
      )}
    </div>
  );
}
