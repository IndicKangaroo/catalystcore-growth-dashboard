import type { Firestore } from 'firebase-admin/firestore';
import type { SettingsRepository } from './types';

/** Firestore-backed settings: the `studio` document in the `settings` collection. */
export function createFirestoreSettingsRepository(db: Firestore): SettingsRepository {
  const studio = db.collection('settings').doc('studio');

  return {
    async getStudio() {
      const snapshot = await studio.get();
      return snapshot.exists ? (snapshot.data() ?? null) : null;
    },
  };
}
