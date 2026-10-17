import { describe, expect, it } from 'vitest';
import { addDays } from '@growth/shared';
import { between, hashText, jitter, unit } from './random';

describe('hashText', () => {
  it('is FNV-1a, so the demo figures stay the same from one release to the next', () => {
    expect(hashText('')).toBe(0x811c9dc5);
    expect(hashText('a')).toBe(0xe40c292c);
    expect(hashText('foobar')).toBe(0xbf9cf968);
  });
});

describe('unit', () => {
  it('depends only on the key', () => {
    expect(unit('app|2026-10-14|active')).toBe(unit('app|2026-10-14|active'));
    expect(unit('app|2026-10-14|active')).not.toBe(unit('app|2026-10-14|new'));
  });

  it('stays from 0 up to, not including, 1', () => {
    for (let index = 0; index < 2000; index += 1) {
      const value = unit(`key-${index}`);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spreads evenly enough that the demo data is not lopsided', () => {
    let total = 0;
    const samples = 4000;
    for (let index = 0; index < samples; index += 1) total += unit(`key-${index}`);
    expect(total / samples).toBeGreaterThan(0.47);
    expect(total / samples).toBeLessThan(0.53);
  });

  it('gives consecutive days different numbers, not a smooth line', () => {
    const seen = new Set<number>();
    let day = '2026-01-01';
    for (let index = 0; index < 366; index += 1) {
      seen.add(unit(`some-app|${day}|active`));
      day = addDays(day, 1);
    }
    expect(seen.size).toBe(366);
  });
});

describe('between and jitter', () => {
  it('keeps to the range it is given', () => {
    for (let index = 0; index < 500; index += 1) {
      const value = between(`key-${index}`, 10, 20);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThan(20);
    }
  });

  it('moves a value by at most the spread, either way', () => {
    for (let index = 0; index < 500; index += 1) {
      const value = jitter(`key-${index}`, 1000, 0.1);
      expect(value).toBeGreaterThanOrEqual(900);
      expect(value).toBeLessThanOrEqual(1100);
    }
  });
});
