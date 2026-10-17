/**
 * Numbers that look random but depend only on the text they are made from. The demo data is built
 * from them, so the same app and day always give the same figures, in any order, on any machine,
 * and no call needs to remember what an earlier call drew.
 */

/** FNV-1a: a small, well-known hash of a string to an unsigned 32-bit number. */
export function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A number from 0 up to, not including, 1 that depends only on `key`. */
export function unit(key: string): number {
  // One round of mulberry32 over the hash moves neighbouring keys, such as consecutive dates, far apart.
  let state = (hashText(key) + 0x6d2b79f5) >>> 0;
  state = Math.imul(state ^ (state >>> 15), state | 1);
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
  return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
}

/** A number from `min` up to `max` that depends only on `key`. */
export function between(key: string, min: number, max: number): number {
  return min + unit(key) * (max - min);
}

/** `value` moved up or down by at most `spread` of itself (0.1 is up to 10% either way). */
export function jitter(key: string, value: number, spread: number): number {
  return value * (1 + (unit(key) - 0.5) * 2 * spread);
}
