import { ROLES } from '@growth/shared';
import type { InviteUserInput, UpdateUserInput, UserRecord } from '@growth/shared';
import type { VerifiedToken } from '../auth/types';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errors';
import type { UserRepository } from './types';

export interface UserServiceOptions {
  repo: UserRepository;
  /** This email may sign in as the first admin even before any user record exists (D-021). */
  bootstrapAdminEmail?: string | undefined;
  now?: () => Date;
}

export interface UserService {
  /** Maps a verified token to the person's record, linking the account on first sign-in. */
  resolveSignedIn(token: VerifiedToken & { email: string }): Promise<UserRecord>;
  recordLogin(email: string): Promise<UserRecord>;
  list(): Promise<UserRecord[]>;
  invite(input: InviteUserInput, actorEmail: string): Promise<UserRecord>;
  update(email: string, patch: UpdateUserInput): Promise<UserRecord>;
}

// The messages name the account, because people with several Google accounts often sign in with
// the wrong one, and the first admin needs to see which email did not match ADMIN_EMAIL.
const notInvited = (email: string) =>
  new AppError(
    403,
    'not_invited',
    `${email} has not been given access. Ask an admin to invite this Google account, or sign out and use a different one.`,
  );

const accountDisabled = (email: string) =>
  new AppError(403, 'account_disabled', `${email} has been deactivated. Ask an admin.`);

const userNotFound = () => new AppError(404, 'user_not_found', 'No such user');

function isActiveAdmin(user: UserRecord): boolean {
  return user.role === 'admin' && user.active;
}

/** Admins first, then growth, then developers; alphabetical by email within a role. */
function compareUsers(a: UserRecord, b: UserRecord): number {
  const byRole = ROLES.indexOf(a.role) - ROLES.indexOf(b.role);
  return byRole !== 0 ? byRole : a.email.localeCompare(b.email);
}

export function createUserService(options: UserServiceOptions): UserService {
  const { repo } = options;
  const now = options.now ?? (() => new Date());
  const bootstrapEmail = options.bootstrapAdminEmail?.trim().toLowerCase();

  return {
    async resolveSignedIn(token) {
      const email = token.email.toLowerCase();
      const isBootstrapAdmin = bootstrapEmail !== undefined && email === bootstrapEmail;
      const existing = await repo.get(email);

      if (existing && !existing.active) throw accountDisabled(email);
      if (existing && existing.uid === token.uid) return existing;
      if (!existing && !isBootstrapAdmin) throw notInvited(email);

      // First sign-in: link the Firebase account, or create the bootstrap admin.
      return repo.runTransaction(async (tx) => {
        const current = await tx.get(email);
        const timestamp = now().toISOString();

        if (current && !current.active) throw accountDisabled(email);

        if (!current) {
          if (!isBootstrapAdmin) throw notInvited(email);
          const created: UserRecord = {
            email,
            name: token.name ?? null,
            role: 'admin',
            active: true,
            uid: token.uid,
            createdAt: timestamp,
            createdBy: null,
            updatedAt: timestamp,
            lastLoginAt: null,
          };
          tx.put(created);
          logger.info('Bootstrap admin created on first sign-in');
          return created;
        }

        const linked: UserRecord = {
          ...current,
          uid: token.uid,
          name: current.name ?? token.name ?? null,
          updatedAt: timestamp,
        };
        tx.put(linked);
        return linked;
      });
    },

    async recordLogin(email) {
      return repo.runTransaction(async (tx) => {
        const current = await tx.get(email);
        if (!current) throw userNotFound();
        const updated: UserRecord = { ...current, lastLoginAt: now().toISOString() };
        tx.put(updated);
        return updated;
      });
    },

    async list() {
      const users = await repo.list();
      return users.sort(compareUsers);
    },

    async invite(input, actorEmail) {
      return repo.runTransaction(async (tx) => {
        const existing = await tx.get(input.email);
        if (existing) {
          throw new AppError(409, 'user_exists', 'This email already has access');
        }
        const timestamp = now().toISOString();
        const created: UserRecord = {
          email: input.email,
          name: null,
          role: input.role,
          active: true,
          uid: null,
          createdAt: timestamp,
          createdBy: actorEmail,
          updatedAt: timestamp,
          lastLoginAt: null,
        };
        tx.put(created);
        return created;
      });
    },

    async update(email, patch) {
      return repo.runTransaction(async (tx) => {
        const current = await tx.get(email);
        if (!current) throw userNotFound();

        const next: UserRecord = {
          ...current,
          role: patch.role ?? current.role,
          active: patch.active ?? current.active,
          updatedAt: now().toISOString(),
        };

        // Never leave the dashboard without an active admin.
        if (isActiveAdmin(current) && !isActiveAdmin(next)) {
          const admins = await tx.listAdmins();
          const others = admins.filter((admin) => admin.email !== email && admin.active);
          if (others.length === 0) {
            throw new AppError(409, 'last_admin', 'At least one active admin is required');
          }
        }

        tx.put(next);
        return next;
      });
    },
  };
}
