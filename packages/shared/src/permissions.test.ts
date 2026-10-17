import { describe, expect, it } from 'vitest';
import { ROLES } from './enums';
import { hasPermission, PERMISSIONS, permissionsFor } from './permissions';

describe('permission matrix', () => {
  it('gives admin every permission', () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission('admin', permission)).toBe(true);
    }
  });

  it('lets only admin manage users', () => {
    expect(ROLES.filter((role) => hasPermission(role, 'users:manage'))).toEqual(['admin']);
  });

  it('lets only admin change the app list', () => {
    expect(ROLES.filter((role) => hasPermission(role, 'apps:write'))).toEqual(['admin']);
  });

  it('lets growth work with campaigns, content, the timeline and reports', () => {
    for (const permission of [
      'campaigns:write',
      'content:write',
      'timeline:write',
      'reports:generate',
    ] as const) {
      expect(hasPermission('growth', permission)).toBe(true);
    }
  });

  it('lets every role read the studio settings that the screens are drawn from', () => {
    expect(ROLES.filter((role) => !hasPermission(role, 'settings:read'))).toEqual([]);
  });

  it('keeps developer to read-only analytics', () => {
    const granted = permissionsFor('developer');
    expect(granted.every((permission) => permission.endsWith(':read'))).toBe(true);
    expect(hasPermission('developer', 'metrics:read')).toBe(true);
    expect(hasPermission('developer', 'campaigns:read')).toBe(false);
    expect(hasPermission('developer', 'reports:generate')).toBe(false);
  });

  it('returns a copy from permissionsFor', () => {
    const list = permissionsFor('developer');
    list.push('users:manage');
    expect(hasPermission('developer', 'users:manage')).toBe(false);
  });
});
