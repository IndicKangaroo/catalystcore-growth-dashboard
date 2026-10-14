import type { UserRecord } from '@growth/shared';

/**
 * Operations available inside one transaction. Do every read before the first put: Firestore
 * requires it, and the in-memory test repository mirrors it.
 */
export interface UserTransaction {
  get(email: string): Promise<UserRecord | null>;
  listAdmins(): Promise<UserRecord[]>;
  /** Creates or replaces the record. The caller has already checked whether it exists. */
  put(user: UserRecord): void;
}

/** Storage for user records, keyed by lowercase email. */
export interface UserRepository {
  get(email: string): Promise<UserRecord | null>;
  list(): Promise<UserRecord[]>;
  runTransaction<T>(fn: (tx: UserTransaction) => Promise<T>): Promise<T>;
}
