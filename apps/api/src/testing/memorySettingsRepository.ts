import type { SettingsRepository } from '../settings/types';

/** In-memory stand-in for the Firestore settings. Used by tests only. */
export function createMemorySettingsRepository(
  studio: Record<string, unknown> | null = null,
): SettingsRepository {
  return {
    async getStudio() {
      return studio === null ? null : structuredClone(studio);
    },
  };
}
