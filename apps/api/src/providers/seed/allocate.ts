/**
 * Splits a whole number into whole parts in proportion to `weights`, so the parts add up to exactly
 * `total` (the largest remainder method). A tie goes to the earlier weight, so the answer depends
 * on nothing but the inputs.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((all, weight) => all + weight, 0);
  if (!(total > 0) || !(sum > 0)) return weights.map(() => 0);

  const exact = weights.map((weight) => (total * weight) / sum);
  const parts = exact.map((share) => Math.floor(share));
  let left = total - parts.reduce((all, part) => all + part, 0);

  const byRemainder = exact
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (left <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    left -= 1;
  }
  return parts;
}
