import { userRecordSchema } from '@growth/shared';
import type { UserRecord } from '@growth/shared';
import type { Firestore } from 'firebase-admin/firestore';
import { readRecords } from '../lib/documents';
import type { UserRepository, UserTransaction } from './types';

const COLLECTION = 'users';

/**
 * A list is read tolerantly (see `readRecords`). Access is never granted from a document that is
 * left out, because sign-in looks a person up by their exact email with the strict `parse` below.
 */
const readUsers = (docs: { data(): unknown }[]): UserRecord[] =>
  readRecords(docs, userRecordSchema, { collection: COLLECTION, what: 'dashboard user records' });

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
      return readUsers(snapshot.docs);
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
            return readUsers(snapshot.docs);
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
