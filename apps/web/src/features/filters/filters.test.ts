import { describe, expect, it } from 'vitest';
import { filterSearch } from './filters';

describe('filterSearch', () => {
  it('is empty when no filter is set', () => {
    expect(filterSearch(new URLSearchParams())).toBe('');
    expect(filterSearch(new URLSearchParams('page=2'))).toBe('');
  });

  it('keeps the filters and drops everything else', () => {
    const params = new URLSearchParams('range=7d&appIds=a%2Cb&page=2&platform=youtube');

    expect(filterSearch(params)).toBe('?range=7d&appIds=a%2Cb&platform=youtube');
  });

  it('keeps a custom range whole', () => {
    const params = new URLSearchParams('range=custom&from=2026-10-01&to=2026-10-15');

    expect(filterSearch(params)).toBe('?range=custom&from=2026-10-01&to=2026-10-15');
  });
});
