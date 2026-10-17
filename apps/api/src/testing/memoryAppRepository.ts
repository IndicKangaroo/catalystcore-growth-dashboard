import type { AppRecord } from '@growth/shared';
import type { AppRepository, AppTransaction } from '../apps/types';

export interface MemoryAppRepository extends AppRepository {
  /** Everything currently stored, for assertions in tests. */
  all(): AppRecord[];
}

type Write = { kind: 'put'; app: AppRecord } | { kind: 'delete'; id: string };

/** In-memory stand-in for the Firestore repository. Used by tests only. */
export function createMemoryAppRepository(seed: AppRecord[] = []): MemoryAppRepository {
  const store = new Map<string, AppRecord>();
  for (const app of seed) {
    store.set(app.id, structuredClone(app));
  }

  const find = (id: string): AppRecord | null => {
    const found = store.get(id);
    return found ? structuredClone(found) : null;
  };

  const all = (): AppRecord[] => [...store.values()].map((app) => structuredClone(app));

  let counter = 0;

  return {
    async get(id) {
      return find(id);
    },

    async list() {
      return all();
    },

    newId() {
      do {
        counter += 1;
      } while (store.has(`app-${counter}`));
      return `app-${counter}`;
    },

    async runTransaction(fn) {
      // Writes are buffered and applied only if the callback succeeds, like a real transaction.
      const writes: Write[] = [];
      const tx: AppTransaction = {
        get: async (id) => find(id),
        list: async () => all(),
        put: (app) => {
          writes.push({ kind: 'put', app: structuredClone(app) });
        },
        delete: (id) => {
          writes.push({ kind: 'delete', id });
        },
      };
      const result = await fn(tx);
      for (const write of writes) {
        if (write.kind === 'put') store.set(write.app.id, write.app);
        else store.delete(write.id);
      }
      return result;
    },

    all,
  };
}
