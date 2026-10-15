import { CURRENT_SCHEMA_VERSION, DEFAULT_STUDIO_SETTINGS } from '@growth/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../middleware/errors';
import { createMemorySettingsRepository } from '../testing/memorySettingsRepository';
import { createStudioSettingsService } from './service';

const serviceFor = (stored: Record<string, unknown> | null) =>
  createStudioSettingsService(createMemorySettingsRepository(stored));

async function failure(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('Expected the call to fail');
}

describe('studio settings', () => {
  it('answers with the defaults, marked as not configured, while the document is missing', async () => {
    expect(await serviceFor(null).get()).toEqual({
      settings: DEFAULT_STUDIO_SETTINGS,
      configured: false,
    });
  });

  it('answers with what the document holds, and fills in what it leaves out', async () => {
    const result = await serviceFor({
      name: 'Example Studio',
      timezone: 'America/New_York',
      currency: 'usd',
    }).get();

    expect(result.configured).toBe(true);
    expect(result.settings).toEqual({
      ...DEFAULT_STUDIO_SETTINGS,
      name: 'Example Studio',
      timezone: 'America/New_York',
      currency: 'USD',
    });
  });

  it('counts an empty document as configured: it exists, and everything in it is a default', async () => {
    expect(await serviceFor({}).get()).toEqual({
      settings: DEFAULT_STUDIO_SETTINGS,
      configured: true,
    });
  });

  it('does not pass on fields it does not know', async () => {
    const result = await serviceFor({ name: 'Example Studio', apiKey: 'should-not-travel' }).get();

    expect(JSON.stringify(result)).not.toContain('should-not-travel');
  });

  it('answers 503 with what to fix when the document is not valid', async () => {
    const error = await failure(serviceFor({ timezone: 'Mars/Olympus' }).get());

    expect(error.status).toBe(503);
    expect(error.code).toBe('studio_settings_invalid');
    expect(error.message).toContain('Server setup problem');
    expect(error.message).toContain('"settings" collection');
    expect(error.message).toContain('timezone: Use a time zone name such as Asia/Kolkata');
  });

  it('asks for an update when the data was written by a newer version', async () => {
    const error = await failure(serviceFor({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }).get());

    expect(error.status).toBe(503);
    expect(error.message).toContain('Update the dashboard');
  });
});
