import { z } from 'zod';
import { calendarDateSchema } from './dates';
import { appStatusSchema } from './enums';
import { blankToNull, httpsUrlOrNull, nullableText } from './fields';

/** The apps a studio tracks (PRD section 5). Stored in the `apps` collection, one document per app. */

export const appNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(80, 'Use at most 80 characters');

// At least two parts separated by dots, as in com.example.myapp. Hyphens are allowed because some
// stores accept them; the dashboard only needs a stable identifier.
const PACKAGE_NAME = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;

export const packageNameSchema = z
  .string()
  .trim()
  .min(3, 'Enter the package name')
  .max(150, 'Use at most 150 characters')
  .regex(PACKAGE_NAME, 'Use the package name, written like com.example.myapp');

// GA4 shows the property ID as digits in Admin > Property details. People often paste the
// "properties/123456789" form, which is accepted and shortened.
export const ga4PropertyIdSchema = z.preprocess(
  (value) => {
    const cleaned = blankToNull(value);
    if (typeof cleaned === 'number' && Number.isSafeInteger(cleaned)) return String(cleaned);
    return typeof cleaned === 'string' ? cleaned.trim().replace(/^properties\//i, '') : cleaned;
  },
  z
    .string()
    .regex(/^\d{4,15}$/, 'Use the numeric GA4 property ID, for example 123456789')
    .nullable(),
);

export const firebaseProjectIdSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/,
      'Use the Firebase project ID: 6 to 30 lowercase letters, digits or hyphens',
    )
    .nullable(),
);

export const launchDateSchema = z.preprocess(blankToNull, calendarDateSchema.nullable());

/** What an admin sends to add an app. Anything optional that is left out is stored as null. */
export const createAppSchema = z.object({
  name: appNameSchema,
  packageName: packageNameSchema,
  status: appStatusSchema.default('development'),
  iconUrl: httpsUrlOrNull.default(null),
  ga4PropertyId: ga4PropertyIdSchema.default(null),
  firebaseProjectId: firebaseProjectIdSchema.default(null),
  playStoreUrl: httpsUrlOrNull.default(null),
  launchDate: launchDateSchema.default(null),
  category: nullableText(60).default(null),
  currentVersion: nullableText(30).default(null),
});
export type CreateAppInput = z.infer<typeof createAppSchema>;

/**
 * What an admin sends to change an app. A field that is left out stays as it is; an optional field
 * sent as null or blank is cleared.
 */
export const updateAppSchema = createAppSchema
  .partial()
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'Provide at least one field to change',
  });
export type UpdateAppInput = z.infer<typeof updateAppSchema>;

export const appRecordSchema = z.object({
  id: z.string().min(1).max(128),
  name: appNameSchema,
  packageName: packageNameSchema,
  status: appStatusSchema,
  iconUrl: httpsUrlOrNull,
  ga4PropertyId: ga4PropertyIdSchema,
  firebaseProjectId: firebaseProjectIdSchema,
  playStoreUrl: httpsUrlOrNull,
  launchDate: launchDateSchema,
  category: nullableText(60),
  currentVersion: nullableText(30),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().nullable(),
});
export type AppRecord = z.infer<typeof appRecordSchema>;

export const appIdParamsSchema = z.object({ id: z.string().trim().min(1).max(128) });

export const appsResponseSchema = z.object({ apps: z.array(appRecordSchema) });
export type AppsResponse = z.infer<typeof appsResponseSchema>;

export const appResponseSchema = z.object({ app: appRecordSchema });
export type AppResponse = z.infer<typeof appResponseSchema>;
