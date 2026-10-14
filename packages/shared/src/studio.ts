import { z } from 'zod';
import { isValidTimeZone } from './dates';
import { datePresetSchema } from './enums';
import { httpsUrlOrNull, nullableText } from './fields';

/**
 * The version of the shape of everything the dashboard stores. Raise it, and ship a migration,
 * whenever a stored document changes shape (AGENTS.md). It is kept in `settings/studio` and covers
 * the whole database; a database without that document is at version 1.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * One studio's identity and preferences, the single `settings/studio` document (D-019). Nothing
 * else in the code names a studio, an app, a time zone or a currency. Every field has a default, so
 * a deployment that has not written the document yet still works; the defaults for time zone and
 * currency are D-014's, and a studio elsewhere sets its own.
 */
export const studioSettingsSchema = z.object({
  schemaVersion: z.number().int().min(1).default(CURRENT_SCHEMA_VERSION),
  name: nullableText(80).default(null),
  logoUrl: httpsUrlOrNull.default(null),
  timezone: z
    .string()
    .trim()
    .refine(isValidTimeZone, { message: 'Use a time zone name such as Asia/Kolkata' })
    .default('Asia/Kolkata'),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code such as INR')
    .default('INR'),
  defaultDateRange: datePresetSchema.default('30d'),
});
export type StudioSettings = z.infer<typeof studioSettingsSchema>;

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = studioSettingsSchema.parse({});

export type StudioSettingsResult =
  | { ok: true; settings: StudioSettings }
  | { ok: false; problem: string };

/** Reads the stored document. A problem is worded for whoever has to fix the stored data. */
export function parseStudioSettings(raw: unknown): StudioSettingsResult {
  const result = studioSettingsSchema.safeParse(raw);
  if (!result.success) {
    const problem = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'settings'}: ${issue.message}`)
      .join('; ');
    return { ok: false, problem };
  }
  if (result.data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      problem:
        `schemaVersion: the data was written by a newer version of the dashboard (schema ` +
        `${result.data.schemaVersion}; this version understands ${CURRENT_SCHEMA_VERSION}). ` +
        'Update the dashboard.',
    };
  }
  return { ok: true, settings: result.data };
}

/** Response of GET /api/settings/studio. `configured` is false while the document does not exist. */
export const studioSettingsResponseSchema = z.object({
  settings: studioSettingsSchema,
  configured: z.boolean(),
});
export type StudioSettingsResponse = z.infer<typeof studioSettingsResponseSchema>;
