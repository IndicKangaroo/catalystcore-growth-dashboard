import { z } from 'zod';

/**
 * Building blocks for optional text fields in stored records. A form sends "" for an empty box, an
 * API client may send null or leave the field out; for a field that can be empty, all of those
 * mean "none" and read back as null.
 */

export function blankToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value;
}

/** Free text of up to `max` characters, or null. */
export function nullableText(max: number) {
  return z.preprocess(
    blankToNull,
    z.string().trim().max(max, `Use at most ${max} characters`).nullable(),
  );
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A web address that starts with https://, or null. Only https is accepted because these addresses
 * become links and images in the app, and an address such as javascript:... must never get there.
 */
export const httpsUrlOrNull = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(2048, 'Use at most 2048 characters')
    .refine(isHttpsUrl, { message: 'Use a web address that starts with https://' })
    .nullable(),
);
