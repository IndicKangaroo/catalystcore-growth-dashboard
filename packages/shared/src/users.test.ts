import { describe, expect, it } from 'vitest';
import { emailParamsSchema, inviteUserSchema, updateUserSchema, userRecordSchema } from './users';

describe('inviteUserSchema', () => {
  it('trims and lowercases the email', () => {
    expect(inviteUserSchema.parse({ email: '  Boss@Example.COM ', role: 'growth' })).toEqual({
      email: 'boss@example.com',
      role: 'growth',
    });
  });

  it('rejects an invalid email', () => {
    expect(inviteUserSchema.safeParse({ email: 'not-an-email', role: 'growth' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown role', () => {
    expect(inviteUserSchema.safeParse({ email: 'a@example.com', role: 'owner' }).success).toBe(
      false,
    );
  });
});

describe('updateUserSchema', () => {
  it('requires at least one field', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a role change', () => {
    expect(updateUserSchema.parse({ role: 'developer' })).toEqual({ role: 'developer' });
  });

  it('accepts an active flag, including false', () => {
    expect(updateUserSchema.parse({ active: false })).toEqual({ active: false });
  });

  it('rejects unknown roles', () => {
    expect(updateUserSchema.safeParse({ role: 'owner' }).success).toBe(false);
  });
});

describe('emailParamsSchema', () => {
  it('normalizes the email taken from a URL', () => {
    expect(emailParamsSchema.parse({ email: 'Person@Example.com' })).toEqual({
      email: 'person@example.com',
    });
  });
});

describe('userRecordSchema', () => {
  const record = {
    email: 'person@example.com',
    name: null,
    role: 'admin',
    active: true,
    uid: null,
    createdAt: '2026-10-11T12:00:00.000Z',
    createdBy: null,
    updatedAt: '2026-10-11T12:00:00.000Z',
    lastLoginAt: null,
  };

  it('accepts a complete record', () => {
    expect(userRecordSchema.parse(record)).toEqual(record);
  });

  it('rejects timestamps that are not UTC ISO strings', () => {
    expect(userRecordSchema.safeParse({ ...record, createdAt: 'yesterday' }).success).toBe(false);
  });
});
