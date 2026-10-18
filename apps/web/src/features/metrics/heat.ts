/**
 * How strongly a cohort cell is shaded, as the opacity of the accent colour over the card. The most
 * it reaches is 45%, so the percentage written in the cell keeps its contrast in both themes;
 * the number itself is always written, and the shade only helps the eye to find the strong cells.
 * Retention of 50% or more is shaded as strongly as it gets.
 */
const FLOOR = 0.06;
const CEILING = 0.45;
const FULL_AT = 0.5;

export function heatAlpha(fraction: number): number {
  const clamped = Math.min(Math.max(fraction, 0), FULL_AT);
  return FLOOR + (clamped / FULL_AT) * (CEILING - FLOOR);
}
