import type { Permission } from '@growth/shared';
import { matchPath } from 'react-router-dom';
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
  // The Apps screen lists the apps themselves and shows no numbers yet, so it has nothing to filter.
  { to: '/apps', label: 'Apps', icon: 'apps', permission: 'apps:read', filters: 'none' },
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

/**
 * A screen that lives under a menu item but is not in the menu, such as one app's page. It has its
 * own title and filter scope, because matching by path prefix would otherwise hand it the scope of
 * the item above it (the Apps list shows no numbers, so its scope is 'none').
 */
export interface NestedScreen {
  /** A react-router path pattern, matched against the whole address. */
  pattern: string;
  label: string;
  filters: FilterScope;
}

export const NESTED_SCREENS: readonly NestedScreen[] = [
  { pattern: '/apps/:appId', label: 'App detail', filters: 'range-and-apps' },
];

export interface Screen {
  label: string;
  filters: FilterScope;
}

/**
 * What the shell needs to know about an address: its title and which filters it honours. A nested
 * screen answers for itself; every other address answers as its menu item does.
 */
export function screenFor(pathname: string): Screen | undefined {
  const nested = NESTED_SCREENS.find((screen) =>
    matchPath({ path: screen.pattern, end: true }, pathname),
  );
  if (nested) return { label: nested.label, filters: nested.filters };

  const item = navItemFor(pathname);
  return item ? { label: item.label, filters: item.filters } : undefined;
}
