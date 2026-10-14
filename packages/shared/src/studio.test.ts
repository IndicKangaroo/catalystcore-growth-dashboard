import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_STUDIO_SETTINGS,
  parseStudioSettings,
  studioSettingsSchema,
} from './studio';

describe('DEFAULT_STUDIO_SETTINGS', () => {
  it('is what a deployment without the document gets (D-014)', () => {
    expect(DEFAULT_STUDIO_SETTINGS).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: null,
      logoUrl: null,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      defaultDateRange: '30d',
    });
  });
});

describe('parseStudioSettings', () => {
  it('fills in whatever the document leaves out', () => {
    const result = parseStudioSettings({ name: '  Example Studio ' });
    expect(result).toEqual({
      ok: true,
      settings: { ...DEFAULT_STUDIO_SETTINGS, name: 'Example Studio' },
    });
  });

  it('reads a complete document', () => {
    const result = parseStudioSettings({
      schemaVersion: 1,
      name: 'Example Studio',
      logoUrl: 'https://example.com/logo.svg',
      timezone: 'America/New_York',
      currency: 'usd',
      defaultDateRange: '7d',
      createdAt: 'ignored extra field',
    });
    expect(result).toEqual({
      ok: true,
      settings: {
        schemaVersion: 1,
        name: 'Example Studio',
        logoUrl: 'https://example.com/logo.svg',
        timezone: 'America/New_York',
        currency: 'USD',
        defaultDateRange: '7d',
      },
    });
  });

  it('treats a blank name or logo as none', () => {
    const result = parseStudioSettings({ name: '', logoUrl: '  ' });
    expect(result).toEqual({ ok: true, settings: DEFAULT_STUDIO_SETTINGS });
  });

  it('names each field that is wrong', () => {
    const result = parseStudioSettings({
      timezone: 'Mars/Olympus',
      currency: 'rupees',
      defaultDateRange: 'forever',
      logoUrl: 'http://example.com/logo.png',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain('timezone: Use a time zone name such as Asia/Kolkata');
      expect(result.problem).toContain('currency: Use a three-letter currency code');
      expect(result.problem).toContain('defaultDateRange:');
      expect(result.problem).toContain('logoUrl: Use a web address that starts with https://');
    }
  });

  it('refuses data written by a newer version, and says to update', () => {
    const result = parseStudioSettings({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain('newer version of the dashboard');
      expect(result.problem).toContain(`this version understands ${CURRENT_SCHEMA_VERSION}`);
    }
  });

  it('refuses a document that is not an object', () => {
    expect(parseStudioSettings('settings').ok).toBe(false);
    expect(parseStudioSettings(null).ok).toBe(false);
  });
});

describe('studioSettingsSchema', () => {
  it('rejects a schema version below one', () => {
    expect(studioSettingsSchema.safeParse({ schemaVersion: 0 }).success).toBe(false);
  });
});
