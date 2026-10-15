import { parseStudioSettings } from '@growth/shared';
import type { StudioSettingsResponse } from '@growth/shared';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errors';
import type { SettingsRepository } from './types';

export interface StudioSettingsService {
  /** The studio's settings with defaults filled in, and whether the document exists yet. */
  get(): Promise<StudioSettingsResponse>;
}

export function createStudioSettingsService(repo: SettingsRepository): StudioSettingsService {
  return {
    async get() {
      const stored = await repo.getStudio();
      const result = parseStudioSettings(stored ?? {});
      if (!result.ok) {
        // A setup problem, like a missing database (D-027): say what to fix, keep the detail in the log.
        logger.error('The studio settings document is not valid', { problem: result.problem });
        throw new AppError(
          503,
          'studio_settings_invalid',
          'Server setup problem: the studio settings cannot be read. In the Firebase console, ' +
            `open the "settings" collection and fix its "studio" document. ${result.problem}`,
        );
      }
      return { settings: result.settings, configured: stored !== null };
    },
  };
}
