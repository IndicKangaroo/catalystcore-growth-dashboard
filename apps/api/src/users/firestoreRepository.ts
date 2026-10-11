import { userRecordSchema } from '@growth/shared';
import type { UserRecord } from '@growth/shared';
import type { Firestore } from 'firebase-admin/firestore';
import type { UserRepository, UserTransaction } from './types';

const COLLECTION = 'users';

/** Firestore-backed user storage. Documents are keyed by lowercase email. */
export function createFirestoreUserRepository(db: Firestore): UserRepository {
  const users = db.collection(COLLECTION);

  // Validate whatever comes out of the database so bad data fails loudly, not subtly.
  const parse = (data: unknown): UserRecord => userRecordSchema.parse(data);

  return {
    async get(email) {
      const snapshot = await users.doc(email).get();
      return snapshot.exists ? parse(snapshot.data()) : null;
    },

    async list() {
      const snapshot = await users.get();
      return snapshot.docs.map((doc) => parse(doc.data()));
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
            return snapshot.docs.map((doc) => parse(doc.data()));
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
