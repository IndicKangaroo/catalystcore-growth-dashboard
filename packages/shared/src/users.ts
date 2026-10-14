import { z } from 'zod';
import { roleSchema } from './enums';
import { PERMISSIONS } from './permissions';

/** Emails are stored and compared in lowercase. */
export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * A person who may sign in. The document id is the email, so it is unique by construction.
 * `uid` is filled in on first sign-in; `name` comes from the Google account.
 */
export const userRecordSchema = z.object({
  email: emailSchema,
  name: z.string().nullable(),
  role: roleSchema,
  active: z.boolean(),
  uid: z.string().nullable(),
  createdAt: z.string().datetime(),
  createdBy: z.string().nullable(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});
export type UserRecord = z.infer<typeof userRecordSchema>;

export const inviteUserSchema = z.object({
  email: emailSchema,
  role: roleSchema,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z
  .object({
    role: roleSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.active !== undefined, {
    message: 'Provide a role or an active flag to update',
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const emailParamsSchema = z.object({ email: emailSchema });

export const permissionSchema = z.enum(PERMISSIONS);

/** Response of GET /api/me: who the caller is and what they may do. */
export const meResponseSchema = z.object({
  user: z.object({
    email: emailSchema,
    name: z.string().nullable(),
    role: roleSchema,
  }),
  permissions: z.array(permissionSchema),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const usersResponseSchema = z.object({ users: z.array(userRecordSchema) });
export type UsersResponse = z.infer<typeof usersResponseSchema>;

export const userResponseSchema = z.object({ user: userRecordSchema });
export type UserResponse = z.infer<typeof userResponseSchema>;
