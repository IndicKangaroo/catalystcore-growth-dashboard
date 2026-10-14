import { userRecordSchema } from '@growth/shared';
import type { UserRecord } from '@growth/shared';
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../lib/logger';
import type { UserRepository, UserTransaction } from './types';

const COLLECTION = 'users';

/**
 * Reads a whole list of documents as user records. A document that is not a dashboard user record
 * is left out and counted, instead of failing the whole list: the usual cause is a Firebase
 * project that is shared with an app whose own `users` collection holds other documents. Access
 * is never granted from such a document, because sign-in looks a person up by their exact email
 * with the strict `parse` below.
 */
function readRecords(docs: { data(): unknown }[]): UserRecord[] {
  const records: UserRecord[] = [];
  let skipped = 0;
  for (const doc of docs) {
    const result = userRecordSchema.safeParse(doc.data());
    if (result.success) {
      records.push(result.data);
    } else {
      skipped += 1;
    }
  }
  if (skipped > 0) {
    logger.warn(
      `Skipped ${skipped} document(s) in the "${COLLECTION}" collection that are not dashboard ` +
        'user records. If this Firebase project is shared with an app, give the dashboard a ' +
        'project of its own (see the README).',
    );
  }
  return records;
}

/** Firestore-backed user storage. Documents are keyed by lowercase email. */
export function createFirestoreUserRepository(db: Firestore): UserRepository {
  const users = db.collection(COLLECTION);

  // A single record is read strictly, so bad data fails loudly, not subtly.
  const parse = (data: unknown): UserRecord => userRecordSchema.parse(data);

  return {
    async get(email) {
      const snapshot = await users.doc(email).get();
      return snapshot.exists ? parse(snapshot.data()) : null;
    },

    async list() {
      const snapshot = await users.get();
      return readRecords(snapshot.docs);
    },

    runTransaction(fn) {
      return db.runTransaction(async (transaction) => {
        const tx: UserTransaction = {
          async get(email) {
            const snapshot = await transaction.get(users.doc(email));
            return snapshot.exists ? parse(snapshot.data()) : null;
          },
          async listAdmins() {
            const snapshot = await transaction.get(users.where('role', '==', 'admin'));
            return readRecords(snapshot.docs);
          },
          put(user) {
            transaction.set(users.doc(user.email), user);
          },
        };
        return fn(tx);
      });
    },
  };
}
