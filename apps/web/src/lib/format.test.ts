import { describe, expect, it } from 'vitest';
import { formatDay, formatDayRange, initialsOf } from './format';

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
