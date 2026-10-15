import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readRecords } from './documents';

const schema = z.object({ name: z.string(), count: z.number().default(0) });
const options = { collection: 'things', what: 'dashboard things' };

const doc = (data: unknown) => ({ data: () => data });

/** Runs `run` and returns what it wrote to the log, one parsed line per entry. */
function captureLog(run: () => void): { level: string; message: string }[] {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line: unknown) => {
    lines.push(String(line));
  };
  try {
    run();
  } finally {
    console.log = original;
  }
  return lines.map((line) => JSON.parse(line) as { level: string; message: string });
}

describe('readRecords', () => {
  it('returns every document that fits the schema, filled in by the schema', () => {
    const records = readRecords(
      [doc({ name: 'a' }), doc({ name: 'b', count: 2 })],
      schema,
      options,
    );

    expect(records).toEqual([
      { name: 'a', count: 0 },
      { name: 'b', count: 2 },
    ]);
  });

  it('leaves out documents that are something else, and says so once', () => {
    let records: unknown[] = [];
    const log = captureLog(() => {
      records = readRecords(
        [doc({ name: 'a' }), doc({ title: 'not ours' }), doc(undefined), doc({ name: 3 })],
        schema,
        options,
      );
    });

    expect(records).toEqual([{ name: 'a', count: 0 }]);
    expect(log).toHaveLength(1);
    expect(log[0]?.level).toBe('warn');
    expect(log[0]?.message).toContain('Skipped 3 document(s) in the "things" collection');
    expect(log[0]?.message).toContain('that are not dashboard things');
    expect(log[0]?.message).toContain('project of its own');
  });

  it('stays quiet when every document fits', () => {
    const log = captureLog(() => {
      readRecords([doc({ name: 'a' })], schema, options);
    });

    expect(log).toEqual([]);
  });

  it('reads an empty collection', () => {
    expect(readRecords([], schema, options)).toEqual([]);
  });
});
