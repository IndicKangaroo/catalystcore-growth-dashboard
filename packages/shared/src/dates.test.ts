import { describe, expect, it } from 'vitest';
import {
  addDays,
  calendarDateSchema,
  daysBetween,
  isCalendarDate,
  isValidTimeZone,
  mondayOnOrBefore,
  todayIn,
  weekdayOf,
} from './dates';

describe('isCalendarDate', () => {
  it.each(['2026-10-14', '2024-02-29', '2000-01-01', '2026-12-31'])('accepts %s', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each([
    '2026-02-31',
    '2025-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-1-5',
    '26-10-14',
    '2026/10/14',
    '2026-10-14T00:00:00Z',
    '',
    'tomorrow',
  ])('rejects %s', (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });
});

describe('calendarDateSchema', () => {
  it('trims and accepts a real date', () => {
    expect(calendarDateSchema.parse(' 2026-10-14 ')).toBe('2026-10-14');
  });

  it('says what a date should look like', () => {
    const result = calendarDateSchema.safeParse('2026-02-31');
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('written like 2026-10-14');
  });
});

describe('addDays', () => {
  it('moves forward and back', () => {
    expect(addDays('2026-10-14', 1)).toBe('2026-10-15');
    expect(addDays('2026-10-14', -14)).toBe('2026-09-30');
    expect(addDays('2026-10-14', 0)).toBe('2026-10-14');
  });

  it('crosses month and year ends, and leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('is not moved by daylight saving changes', () => {
    // Clocks change in the US on 2026-03-08 and in Europe on 2026-03-29.
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('refuses a value that is not a date', () => {
    expect(() => addDays('2026-02-31', 1)).toThrow(RangeError);
  });
});

describe('daysBetween', () => {
  it('counts whole days in either direction', () => {
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
    expect(daysBetween('2026-10-14', '2026-10-21')).toBe(7);
    expect(daysBetween('2026-10-21', '2026-10-14')).toBe(-7);
    expect(daysBetween('2025-12-31', '2026-12-31')).toBe(365);
    expect(daysBetween('2023-12-31', '2024-12-31')).toBe(366);
  });
});

describe('weekdayOf and mondayOnOrBefore', () => {
  it('knows the weekday (2026-10-14 is a Wednesday)', () => {
    expect(weekdayOf('2026-10-14')).toBe(3);
    expect(weekdayOf('2026-10-18')).toBe(0);
    expect(weekdayOf('2026-10-12')).toBe(1);
  });

  it('finds the Monday that starts the week', () => {
    expect(mondayOnOrBefore('2026-10-12')).toBe('2026-10-12');
    expect(mondayOnOrBefore('2026-10-14')).toBe('2026-10-12');
    expect(mondayOnOrBefore('2026-10-18')).toBe('2026-10-12');
    expect(mondayOnOrBefore('2026-10-19')).toBe('2026-10-19');
    expect(mondayOnOrBefore('2026-01-01')).toBe('2025-12-29');
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
  });

  it('rejects names that are not time zones', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('IST time')).toBe(false);
  });
});

describe('todayIn', () => {
  it('cuts the day where the studio is, not in UTC', () => {
    // 19:00 UTC on 14 October is 00:30 on 15 October in India (UTC+05:30).
    const now = new Date('2026-10-14T19:00:00Z');
    expect(todayIn('UTC', now)).toBe('2026-10-14');
    expect(todayIn('Asia/Kolkata', now)).toBe('2026-10-15');
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-10-14');
  });

  it('moves back a day for zones behind UTC early in the UTC day', () => {
    const now = new Date('2026-10-14T03:00:00Z');
    expect(todayIn('UTC', now)).toBe('2026-10-14');
    expect(todayIn('America/New_York', now)).toBe('2026-10-13');
  });

  it('follows daylight saving time', () => {
    // New York is UTC-5 in winter and UTC-4 in summer: 04:30 UTC is still the day before in winter
    // and already the same day in summer.
    expect(todayIn('America/New_York', new Date('2026-01-15T04:30:00Z'))).toBe('2026-01-14');
    expect(todayIn('America/New_York', new Date('2026-07-15T04:30:00Z'))).toBe('2026-07-15');
  });

  it('throws for a time zone it does not know', () => {
    expect(() => todayIn('Not/AZone', new Date())).toThrow(RangeError);
  });
});
