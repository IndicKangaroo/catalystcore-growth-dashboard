import { describe, expect, it } from 'vitest';
import { metricMissing, metricOk } from './analytics';
import { changeBetween } from './compare';

describe('changeBetween', () => {
  it('gives the change as a fraction of the previous number', () => {
    expect(changeBetween(metricOk(150), metricOk(100))).toEqual({ kind: 'change', fraction: 0.5 });
    expect(changeBetween(metricOk(75), metricOk(100))).toEqual({
      kind: 'change',
      fraction: -0.25,
    });
  });

  it('gives no change when nothing moved, as zero change and not as a missing number', () => {
    expect(changeBetween(metricOk(100), metricOk(100))).toEqual({ kind: 'change', fraction: 0 });
  });

  it('says why there is no change when a number is missing', () => {
    expect(changeBetween(metricMissing('in_progress'), metricOk(100))).toEqual({
      kind: 'none',
      reason: 'no_current',
    });
    expect(changeBetween(metricOk(100), metricMissing('not_enough_data'))).toEqual({
      kind: 'none',
      reason: 'no_previous',
    });
  });

  it('does not divide by a previous number of zero', () => {
    expect(changeBetween(metricOk(10), metricOk(0))).toEqual({
      kind: 'none',
      reason: 'previous_zero',
    });
  });
});
