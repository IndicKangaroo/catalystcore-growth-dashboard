import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, isActivePath, navItemFor, screenFor } from './navigation';

describe('isActivePath', () => {
  it('matches the item address and the addresses below it', () => {
    const apps = { to: '/apps' };

    expect(isActivePath('/apps', apps)).toBe(true);
    expect(isActivePath('/apps/abc', apps)).toBe(true);
    expect(isActivePath('/applications', apps)).toBe(false);
  });

  it('matches only the exact address when the item is "end"', () => {
    const home = { to: '/', end: true };

    expect(isActivePath('/', home)).toBe(true);
    expect(isActivePath('/apps', home)).toBe(false);
  });
});

describe('navItemFor', () => {
  it('finds the screen an address belongs to', () => {
    expect(navItemFor('/')?.label).toBe('Overview');
    expect(navItemFor('/apps')?.label).toBe('Apps');
    expect(navItemFor('/settings/users')?.label).toBe('Users');
  });

  it('finds nothing for an address that is not a screen', () => {
    expect(navItemFor('/no/such/page')).toBeUndefined();
  });
});

describe('screenFor', () => {
  it('answers as the menu item does for a screen that is in the menu', () => {
    expect(screenFor('/')).toEqual({ label: 'Overview', filters: 'range-and-apps' });
    expect(screenFor('/apps')).toEqual({ label: 'Apps', filters: 'none' });
    expect(screenFor('/settings/users')).toEqual({ label: 'Users', filters: 'none' });
  });

  it('lets a nested screen use its own filters instead of its parent item', () => {
    // /apps/:id is under the Apps item, whose list shows no numbers (scope 'none'); the page of one
    // app does show numbers, so it must not inherit that scope.
    expect(navItemFor('/apps/abc')?.filters).toBe('none');
    expect(screenFor('/apps/abc')).toEqual({ label: 'App detail', filters: 'range-and-apps' });
  });

  it('matches a nested screen only at its own address', () => {
    expect(screenFor('/apps/abc/')?.label).toBe('App detail');
    expect(screenFor('/apps/abc/extra')?.label).toBe('Apps');
    expect(screenFor('/apps/abc/extra')?.filters).toBe('none');
  });

  it('finds nothing for an address that is not a screen', () => {
    expect(screenFor('/no/such/page')).toBeUndefined();
  });
});

describe('the menu', () => {
  it('has one address per item', () => {
    const addresses = NAV_ITEMS.map((item) => item.to);

    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('asks for a permission wherever the screen is not for everyone', () => {
    expect(NAV_ITEMS.find((item) => item.to === '/settings/users')?.permission).toBe(
      'users:manage',
    );
  });
});
