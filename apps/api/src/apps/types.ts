import type { AppRecord } from '@growth/shared';

/**
 * Operations available inside one transaction. Do every read before the first write: Firestore
 * requires it, and the in-memory test repository mirrors it.
 */
export interface AppTransaction {
  get(id: string): Promise<AppRecord | null>;
  list(): Promise<AppRecord[]>;
  /** Creates or replaces the record. The caller has already checked whether it exists. */
  put(app: AppRecord): void;
  delete(id: string): void;
}

/** Storage for the apps a studio tracks (PRD section 5), keyed by a generated id. */
export interface AppRepository {
  get(id: string): Promise<AppRecord | null>;
  list(): Promise<AppRecord[]>;
  /** An id that no app has. */
  newId(): string;
  runTransaction<T>(fn: (tx: AppTransaction) => Promise<T>): Promise<T>;
}
