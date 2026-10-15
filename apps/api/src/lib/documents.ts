import type { z } from 'zod';
import { logger } from './logger';

export interface ReadOptions {
  /** The collection the documents came from, as it is named in the database. */
  collection: string;
  /** What a good document is called, for the log line: "dashboard user records". */
  what: string;
}

/**
 * Reads a whole list of documents as records of one kind. A document that is not such a record is
 * left out and counted, instead of failing the whole list (D-028): the usual cause is a Firebase
 * project that is shared with an app whose own collection of the same name holds other documents.
 * Whatever is left out is never trusted for anything; a single record is read strictly, by its id.
 */
export function readRecords<T>(
  docs: readonly { data(): unknown }[],
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: ReadOptions,
): T[] {
  const records: T[] = [];
  let skipped = 0;
  for (const doc of docs) {
    const result = schema.safeParse(doc.data());
    if (result.success) {
      records.push(result.data);
    } else {
      skipped += 1;
    }
  }
  if (skipped > 0) {
    logger.warn(
      `Skipped ${skipped} document(s) in the "${options.collection}" collection that are not ` +
        `${options.what}. If this Firebase project is shared with an app, give the dashboard a ` +
        'project of its own (see the README).',
    );
  }
  return records;
}
