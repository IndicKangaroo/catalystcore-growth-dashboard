import { describe, expect, it } from 'vitest';
import {
  analyticsQuerySchema,
  defaultFilters,
  filtersToParams,
  mergeFilterParams,
  parseFilters,
  toApiQuery,
} from './filters';
import type { FilterState } from './filters';

const params = (query: string) => new URLSearchParams(query);

describe('parseFilters', () => {
  it('shows the default view for an empty address', () => {
    expect(parseFilters(params(''), '30d')).toEqual(defaultFilters('30d'));
  });

  it.each(['today', '7d', '30d', '90d'] as const)('reads the %s quick range', (preset) => {
    expect(parseFilters(params(`range=${preset}`), '30d').range).toEqual({
      kind: 'preset',
      preset,
    });
  });

  it('reads a custom range only when both dates are real and in order', () => {
    expect(parseFilters(params('range=custom&from=2026-09-01&to=2026-09-30'), '30d').range).toEqual(
      { kind: 'custom', from: '2026-09-01', to: '2026-09-30' },
    );
    for (const bad of [
      'range=custom',
      'range=custom&from=2026-09-01',
      'range=custom&from=2026-09-30&to=2026-09-01',
      'range=custom&from=2026-02-31&to=2026-03-05',
      'range=custom&from=2024-01-01&to=2026-09-30',
    ]) {
      expect(parseFilters(params(bad), '7d').range).toEqual({ kind: 'preset', preset: '7d' });
    }
  });

  it('ignores from and to when the range is a quick one', () => {
    expect(parseFilters(params('range=7d&from=2026-09-01&to=2026-09-30'), '30d').range).toEqual({
      kind: 'preset',
      preset: '7d',
    });
  });

  it('falls back to the default for an unknown range', () => {
    expect(parseFilters(params('range=forever'), '90d').range).toEqual({
      kind: 'preset',
      preset: '90d',
    });
  });

  it('reads apps as a list, dropping blanks and repeats', () => {
    expect(parseFilters(params('appIds=a1,%20b2%20,,a1'), '30d').appIds).toEqual(['a1', 'b2']);
  });

  it('reads platform, campaign and content type, and ignores values it does not know', () => {
    const good = parseFilters(params('platform=instagram&campaignId=c-7&contentType=reel'), '30d');
    expect(good).toMatchObject({ platform: 'instagram', campaignId: 'c-7', contentType: 'reel' });

    const bad = parseFilters(params('platform=myspace&campaignId=&contentType=video'), '30d');
    expect(bad).toMatchObject({ platform: null, campaignId: null, contentType: null });
  });
});

describe('filtersToParams', () => {
  it('leaves out everything that is the default', () => {
    expect(filtersToParams(defaultFilters('30d'), '30d').toString()).toBe('');
  });

  it('writes a quick range that is not the default', () => {
    const state: FilterState = {
      ...defaultFilters('30d'),
      range: { kind: 'preset', preset: '7d' },
    };
    expect(filtersToParams(state, '30d').toString()).toBe('range=7d');
  });

  it('writes a custom range with its dates', () => {
    const state: FilterState = {
      ...defaultFilters('30d'),
      range: { kind: 'custom', from: '2026-09-01', to: '2026-09-30' },
    };
    expect(filtersToParams(state, '30d').toString()).toBe(
      'range=custom&from=2026-09-01&to=2026-09-30',
    );
  });

  it('round-trips through parseFilters', () => {
    const states: FilterState[] = [
      defaultFilters('30d'),
      { ...defaultFilters('30d'), range: { kind: 'preset', preset: 'today' } },
      {
        range: { kind: 'custom', from: '2026-01-01', to: '2026-03-31' },
        appIds: ['a1', 'b2'],
        platform: 'youtube',
        campaignId: 'launch-1',
        contentType: 'short',
      },
    ];
    for (const state of states) {
      expect(parseFilters(filtersToParams(state, '30d'), '30d')).toEqual(state);
    }
  });
});

describe('mergeFilterParams', () => {
  it('replaces the filters and keeps other parameters', () => {
    const current = params('tab=users&range=7d&platform=reddit&appIds=a1');
    const state: FilterState = { ...defaultFilters('30d'), appIds: ['b2'] };
    const next = mergeFilterParams(current, state, '30d');
    expect(next.get('tab')).toBe('users');
    expect(next.get('range')).toBeNull();
    expect(next.get('platform')).toBeNull();
    expect(next.get('appIds')).toBe('b2');
  });

  it('does not change the address it was given', () => {
    const current = params('range=7d');
    mergeFilterParams(current, defaultFilters('30d'), '30d');
    expect(current.toString()).toBe('range=7d');
  });
});

describe('toApiQuery', () => {
  const now = new Date('2026-10-14T12:00:00Z');

  it('turns a quick range into days in the studio time zone', () => {
    const query = toApiQuery(defaultFilters('7d'), now, 'UTC');
    expect(query.get('from')).toBe('2026-10-08');
    expect(query.get('to')).toBe('2026-10-14');
    expect(query.has('appIds')).toBe(false);
  });

  it('carries the other filters under the same names', () => {
    const state: FilterState = {
      range: { kind: 'custom', from: '2026-09-01', to: '2026-09-30' },
      appIds: ['a1', 'b2'],
      platform: 'pinterest',
      campaignId: 'c1',
      contentType: 'pin',
    };
    expect(Object.fromEntries(toApiQuery(state, now, 'UTC'))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      appIds: 'a1,b2',
      platform: 'pinterest',
      campaignId: 'c1',
      contentType: 'pin',
    });
  });

  it('is accepted by the API schema', () => {
    const state: FilterState = { ...defaultFilters('30d'), appIds: ['a1'], platform: 'instagram' };
    const query = Object.fromEntries(toApiQuery(state, now, 'Asia/Kolkata'));
    expect(analyticsQuerySchema.parse(query)).toEqual({
      from: '2026-09-15',
      to: '2026-10-14',
      appIds: ['a1'],
      platform: 'instagram',
    });
  });
});

describe('analyticsQuerySchema', () => {
  it('needs both dates, and turns the app list into an array', () => {
    expect(analyticsQuerySchema.safeParse({ from: '2026-10-01' }).success).toBe(false);
    expect(analyticsQuerySchema.parse({ from: '2026-10-01', to: '2026-10-14' }).appIds).toEqual([]);
    expect(
      analyticsQuerySchema.parse({ from: '2026-10-01', to: '2026-10-14', appIds: 'a1, b2' }).appIds,
    ).toEqual(['a1', 'b2']);
  });

  it('says what is wrong with a range', () => {
    const result = analyticsQuerySchema.safeParse({ from: '2026-10-14', to: '2026-10-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('The start date is after the end date');
    }
  });

  it('refuses unknown platforms and content types', () => {
    const base = { from: '2026-10-01', to: '2026-10-14' };
    expect(analyticsQuerySchema.safeParse({ ...base, platform: 'myspace' }).success).toBe(false);
    expect(analyticsQuerySchema.safeParse({ ...base, contentType: 'video' }).success).toBe(false);
  });

  it('refuses too many apps', () => {
    const ids = Array.from({ length: 51 }, (_, index) => `app${index}`).join(',');
    const result = analyticsQuerySchema.safeParse({
      from: '2026-10-01',
      to: '2026-10-14',
      appIds: ids,
    });
    expect(result.success).toBe(false);
  });

  it('refuses a repeated parameter, which arrives as a list', () => {
    const result = analyticsQuerySchema.safeParse({
      from: '2026-10-01',
      to: '2026-10-14',
      appIds: ['a1', 'b2'],
    });
    expect(result.success).toBe(false);
  });
});
