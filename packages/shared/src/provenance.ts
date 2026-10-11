import type { Provenance } from './enums';
import { PROVENANCE } from './enums';

export interface ProvenancedCount {
  provenance: Provenance;
  users: number;
}

/** Total users per provenance bucket. Every bucket is present, even when zero. */
export function sumByProvenance(rows: readonly ProvenancedCount[]): Record<Provenance, number> {
  const totals = Object.fromEntries(PROVENANCE.map((p) => [p, 0])) as Record<Provenance, number>;
  for (const row of rows) {
    totals[row.provenance] += row.users;
  }
  return totals;
}

/**
 * Headline attributed users: measured only (D-002).
 * Inferred and manual counts must be shown separately and never added into this number.
 */
export function headlineAttributedUsers(rows: readonly ProvenancedCount[]): number {
  return sumByProvenance(rows).measured;
}
