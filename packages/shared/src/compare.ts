import type { MetricValue } from './analytics';

/**
 * How one number moved against the same number in the previous period (D-039). A change is only
 * given when both numbers exist and the earlier one is above zero; otherwise the answer says why
 * there is no change, so a screen can write words instead of a made-up percentage.
 */
type Change = { kind: 'change'; fraction: number };
type NoChange = { kind: 'none'; reason: 'no_current' | 'no_previous' | 'previous_zero' };
export type ChangeResult = Change | NoChange;

export function changeBetween(current: MetricValue, previous: MetricValue): ChangeResult {
  if (current.state !== 'ok') return { kind: 'none', reason: 'no_current' };
  if (previous.state !== 'ok') return { kind: 'none', reason: 'no_previous' };
  if (previous.value <= 0) return { kind: 'none', reason: 'previous_zero' };
  return { kind: 'change', fraction: (current.value - previous.value) / previous.value };
}
