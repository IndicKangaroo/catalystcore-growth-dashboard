import type { Role } from './enums';

/**
 * What a signed-in person may do. The API enforces these on every route and the web app uses the
 * same list to show or hide actions (D-025). Routes and components check permissions, never role
 * names.
 */
export const PERMISSIONS = [
  'apps:read',
  'apps:write',
  'metrics:read',
  'acquisition:read',
  'campaigns:read',
  'campaigns:write',
  'content:read',
  'content:write',
  'timeline:read',
  'timeline:write',
  'reports:read',
  'reports:generate',
  'settings:read',
  'users:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// `settings:read` is the studio's name, logo, time zone and date defaults, which every screen needs
// to draw itself; changing them (`settings:write`) arrives with the settings screen in P10.

// PRD section 19: Growth/Social gets analytics, campaigns, content and reports.
const GROWTH_PERMISSIONS: readonly Permission[] = [
  'apps:read',
  'metrics:read',
  'acquisition:read',
  'campaigns:read',
  'campaigns:write',
  'content:read',
  'content:write',
  'timeline:read',
  'timeline:write',
  'reports:read',
  'reports:generate',
  'settings:read',
];

// PRD section 19: Developer gets app analytics and technical metrics.
const DEVELOPER_PERMISSIONS: readonly Permission[] = [
  'apps:read',
  'metrics:read',
  'acquisition:read',
  'timeline:read',
  'settings:read',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // PRD section 19: Admin has full access.
  admin: PERMISSIONS,
  growth: GROWTH_PERMISSIONS,
  developer: DEVELOPER_PERMISSIONS,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** A copy of the role's permissions, safe to modify or send over the wire. */
export function permissionsFor(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
