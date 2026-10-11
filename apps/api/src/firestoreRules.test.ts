import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rulesPath = fileURLToPath(new URL('../../../firestore.rules', import.meta.url));

describe('firestore.rules', () => {
  it('denies all client access, because the API is the only way in (D-022)', () => {
    const source = readFileSync(rulesPath, 'utf8');
    const withoutComments = source.replace(/\/\/.*$/gm, '');
    const allows = withoutComments.match(/allow[^;]*;/g) ?? [];
    expect(allows).toEqual(['allow read, write: if false;']);
  });
});
