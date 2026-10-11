import { describe, expect, it } from 'vitest';
import { headlineAttributedUsers, sumByProvenance } from './provenance';

describe('provenance helpers', () => {
  const rows = [
    { provenance: 'measured', users: 820 },
    { provenance: 'inferred', users: 464 },
    { provenance: 'manual', users: 12 },
    { provenance: 'measured', users: 10 },
  ] as const;

  it('sums users per provenance bucket', () => {
    expect(sumByProvenance(rows)).toEqual({ measured: 830, inferred: 464, manual: 12 });
  });

  it('returns zero for buckets with no rows', () => {
    expect(sumByProvenance([])).toEqual({ measured: 0, inferred: 0, manual: 0 });
  });

  it('headline attributed users counts measured only', () => {
    expect(headlineAttributedUsers(rows)).toBe(830);
  });

  it('never includes inferred or manual users in the headline', () => {
    expect(
      headlineAttributedUsers([
        { provenance: 'inferred', users: 500 },
        { provenance: 'manual', users: 50 },
      ]),
    ).toBe(0);
  });
});
