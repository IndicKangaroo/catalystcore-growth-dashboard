import type { UserRecord } from '@growth/shared';
import type { UserRepository, UserTransaction } from '../users/types';

export interface MemoryUserRepository extends UserRepository {
  /** Everything currently stored, for assertions in tests. */
  all(): UserRecord[];
}

/** In-memory stand-in for the Firestore repository. Used by tests only. */
export function createMemoryUserRepository(seed: UserRecord[] = []): MemoryUserRepository {
  const store = new Map<string, UserRecord>();
  for (const user of seed) {
    store.set(user.email, structuredClone(user));
  }

  const find = (email: string): UserRecord | null => {
    const found = store.get(email);
    return found ? structuredClone(found) : null;
  };

  const all = (): UserRecord[] => [...store.values()].map((user) => structuredClone(user));

  return {
    async get(email) {
      return find(email);
    },

    async list() {
      return all();
    },

    async runTransaction(fn) {
      // Writes are buffered and applied only if the callback succeeds, like a real transaction.
      const writes: UserRecord[] = [];
      const tx: UserTransaction = {
        get: async (email) => find(email),
        listAdmins: async () => all().filter((user) => user.role === 'admin'),
        put: (user) => {
          writes.push(structuredClone(user));
        },
      };
      const result = await fn(tx);
      for (const user of writes) {
        store.set(user.email, user);
      }
      return result;
    },

    all,
  };
}
