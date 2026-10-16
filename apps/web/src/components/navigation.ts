import type { Permission } from '@growth/shared';
import type { IconName } from './Icon';

/** Which global filters a screen honours, so the top bar only offers what the screen will use. */
export type FilterScope = 'none' | 'range' | 'range-and-apps';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Only people whose role includes this permission see the item. */
  permission?: Permission;
  /** Active on exactly this address only, not on the addresses below it. */
  end?: boolean;
  filters: FilterScope;
}

/** The menu lists only screens that exist (D-030). A screen is added here when it is built. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Overview', icon: 'overview', end: true, filters: 'range-and-apps' },
  { to: '/apps', label: 'Apps', icon: 'apps', permission: 'apps:read', filters: 'range' },
  {
    to: '/settings/users',
    label: 'Users',
    icon: 'users',
    permission: 'users:manage',
    filters: 'none',
  },
];

export function isActivePath(pathname: string, item: Pick<NavItem, 'to' | 'end'>): boolean {
  if (pathname === item.to) return true;
  return !item.end && pathname.startsWith(`${item.to}/`);
}

/** The menu item for an address, or undefined for an address that is not a screen. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isActivePath(pathname, item));
}
