import { appRecordSchema } from '@growth/shared';
import type { AppRecord } from '@growth/shared';
import type { Firestore } from 'firebase-admin/firestore';
import { readRecords } from '../lib/documents';
import type { AppRepository, AppTransaction } from './types';

const COLLECTION = 'apps';

/** A list is read tolerantly (see `readRecords`); a single app is read strictly, by its id. */
const readApps = (docs: { data(): unknown }[]): AppRecord[] =>
  readRecords(docs, appRecordSchema, { collection: COLLECTION, what: 'dashboard app records' });

/** Firestore-backed app storage. The document id is the app's id. */
export function createFirestoreAppRepository(db: Firestore): AppRepository {
  const apps = db.collection(COLLECTION);

  const parse = (data: unknown): AppRecord => appRecordSchema.parse(data);

  return {
    async get(id) {
      const snapshot = await apps.doc(id).get();
      return snapshot.exists ? parse(snapshot.data()) : null;
    },

    async list() {
      const snapshot = await apps.get();
      return readApps(snapshot.docs);
    },

    newId: () => apps.doc().id,

    runTransaction(fn) {
      return db.runTransaction(async (transaction) => {
        const tx: AppTransaction = {
          async get(id) {
            const snapshot = await transaction.get(apps.doc(id));
            return snapshot.exists ? parse(snapshot.data()) : null;
          },
          async list() {
            const snapshot = await transaction.get(apps);
            return readApps(snapshot.docs);
          },
          put(app) {
            transaction.set(apps.doc(app.id), app);
          },
          delete(id) {
            transaction.delete(apps.doc(id));
          },
        };
        return fn(tx);
      });
    },
  };
}
