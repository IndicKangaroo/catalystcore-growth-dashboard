import { FieldPath } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { DailyMetrics, SnapshotStore } from './types';

const COLLECTION = 'metricSnapshots';

const isDay = (data: unknown): data is DailyMetrics & { propertyId: string; appId: string } => {
  const d = data as Record<string, unknown> | undefined;
  return (
    !!d &&
    typeof d.date === 'string' &&
    typeof d.propertyId === 'string' &&
    ['activeUsers', 'newUsers', 'sessions', 'engagementSeconds'].every(
      (key) => typeof d[key] === 'number',
    )
  );
};

/**
 * Firestore-backed saved days: one document per app and day. A day saved for another property
 * (the app's property ID was changed) is ignored, so old numbers never pass for the new property's.
 */
export function createFirestoreSnapshotStore(db: Firestore): SnapshotStore {
  const days = db.collection(COLLECTION);
  return {
    async read(appId, propertyId, from, to) {
      // A range over the document id (`<appId>_<date>`) needs no composite index.
      const snapshot = await days
        .where(FieldPath.documentId(), '>=', `${appId}_${from}`)
        .where(FieldPath.documentId(), '<=', `${appId}_${to}`)
        .get();
      return snapshot.docs.flatMap((doc) => {
        const data: unknown = doc.data();
        if (!isDay(data) || data.propertyId !== propertyId) return [];
        const { date, activeUsers, newUsers, sessions, engagementSeconds } = data;
        return [{ date, activeUsers, newUsers, sessions, engagementSeconds }];
      });
    },
    async write(appId, propertyId, list) {
      for (let at = 0; at < list.length; at += 400) {
        const batch = db.batch();
        for (const day of list.slice(at, at + 400)) {
          batch.set(days.doc(`${appId}_${day.date}`), {
            appId,
            propertyId,
            ...day,
            savedAt: new Date().toISOString(),
          });
        }
        await batch.commit();
      }
    },
  };
}
