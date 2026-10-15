import type { AppRecord } from '@growth/shared';
import { FIXED_TIME } from './time';

/** A complete app record with sensible defaults. The package name follows from the id. */
export function makeApp(overrides: Partial<AppRecord> & Pick<AppRecord, 'id'>): AppRecord {
  return {
    name: `App ${overrides.id}`,
    packageName: `com.example.${overrides.id.replace(/[^A-Za-z0-9]/g, '')}`,
    status: 'production',
    iconUrl: null,
    ga4PropertyId: null,
    firebaseProjectId: null,
    playStoreUrl: null,
    launchDate: null,
    category: null,
    currentVersion: null,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    createdBy: null,
    ...overrides,
  };
}
