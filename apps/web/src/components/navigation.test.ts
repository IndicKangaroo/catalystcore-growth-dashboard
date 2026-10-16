import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, isActivePath, navItemFor } from './navigation';

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
