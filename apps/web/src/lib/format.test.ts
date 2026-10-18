import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatDay,
  formatDayRange,
  formatDuration,
  formatPercent,
  formatShortDay,
  formatSignedPercent,
  initialsOf,
} from './format';

describe('formatDay', () => {
  it('writes a calendar day as day, short month and year', () => {
    expect(formatDay('2026-10-15')).toBe('15 Oct 2026');
    expect(formatDay('2026-01-05')).toBe('5 Jan 2026');
    expect(formatDay('2026-09-30')).toBe('30 Sep 2026');
  });

  it('leaves anything that is not a real day as it was', () => {
    expect(formatDay('2026-02-31')).toBe('2026-02-31');
    expect(formatDay('soon')).toBe('soon');
  });
});

describe('formatDayRange', () => {
  it('joins the two ends with an en dash', () => {
    expect(formatDayRange({ from: '2026-09-16', to: '2026-10-15' })).toBe(
      '16 Sep 2026 – 15 Oct 2026',
    );
  });

  it('names one day once when the range is a single day', () => {
    expect(formatDayRange({ from: '2026-10-15', to: '2026-10-15' })).toBe('15 Oct 2026');
  });
});

describe('initialsOf', () => {
  it('takes the first and last word of a name', () => {
    expect(initialsOf('Ada Admin')).toBe('AA');
    expect(initialsOf('Ada B. Lovelace')).toBe('AL');
  });

  it('takes one letter from a single word', () => {
    expect(initialsOf('Grace')).toBe('G');
  });

  it('reads an email address by its part before the @', () => {
    expect(initialsOf('grace@example.com')).toBe('G');
    expect(initialsOf('grace.hopper@example.com')).toBe('GH');
  });

  it('falls back to a question mark for nothing usable', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('@example.com')).toBe('?');
  });
});

describe('formatCount', () => {
  it('keeps a small count whole, with thousands separated', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1284)).toBe('1,284');
    expect(formatCount(9999)).toBe('9,999');
  });

  it('shortens from ten thousand up', () => {
    expect(formatCount(12_900)).toBe('12.9K');
    expect(formatCount(10_000)).toBe('10K');
    expect(formatCount(4_200_000)).toBe('4.2M');
  });

  it('does not write a thousand thousands', () => {
    expect(formatCount(999_999)).toBe('1M');
  });
});

describe('formatPercent and formatSignedPercent', () => {
  it('writes a fraction with one decimal', () => {
    expect(formatPercent(0.2345)).toBe('23.5%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('signs a change, and leaves a change that rounds to nothing unsigned', () => {
    expect(formatSignedPercent(0.123)).toBe('+12.3%');
    expect(formatSignedPercent(-0.045)).toBe('-4.5%');
    expect(formatSignedPercent(0)).toBe('0.0%');
    expect(formatSignedPercent(0.0002)).toBe('0.0%');
    expect(formatSignedPercent(-0.0002)).toBe('0.0%');
  });
});

describe('formatDuration', () => {
  it('writes seconds, minutes and hours', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 05s');
    expect(formatDuration(3720)).toBe('1h 02m');
  });

  it('rounds to whole seconds', () => {
    expect(formatDuration(59.6)).toBe('1m 00s');
  });
});

describe('formatShortDay', () => {
  it('writes day and month for an axis', () => {
    expect(formatShortDay('2026-10-05')).toBe('5 Oct');
  });

  it('leaves what is not a calendar day unchanged', () => {
    expect(formatShortDay('soon')).toBe('soon');
  });
});
