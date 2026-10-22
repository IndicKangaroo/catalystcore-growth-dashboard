import { describe, expect, it } from 'vitest';
import { allPassed, runGa4Check } from './check';
import { fakeGa4Client, hasMetric, report, row } from './testing';

describe('runGa4Check', () => {
  it('reports each read when the property can be read', async () => {
    const client = fakeGa4Client((_id, request) => {
      if (request.cohortSpec) return report();
      if (hasMetric(request, 'active28DayUsers')) return report(row([], [5, 20, 60]));
      if (request.dimensions?.some((d) => d.name === 'date')) {
        return report(row(['20261010'], [5, 2, 9, 90]));
      }
      if (request.dimensions?.some((d) => d.name === 'firstUserSource')) {
        return report(row(['google-play', 'organic', 'Organic Search', '(not set)'], [30]));
      }
      return report(row([], [50, 20, 90, 900]));
    });

    const lines = await runGa4Check(client, '123', '2026-10-21');

    expect(allPassed(lines)).toBe(true);
    expect(lines.map((line) => line.text.split(':')[0])).toEqual([
      'Connection and users',
      'Retention (weekly install cohorts)',
      'Acquisition by source',
      'Daily series',
    ]);
  });

  it('stops at the first failure and says what to fix', async () => {
    const client = fakeGa4Client(() => {
      throw new Error('GA4 refused access to property 123. Add the service account as a Viewer.');
    });

    const lines = await runGa4Check(client, '123', '2026-10-21');

    expect(lines).toHaveLength(1);
    expect(allPassed(lines)).toBe(false);
    expect(lines[0]?.text).toContain('Viewer');
  });
});
