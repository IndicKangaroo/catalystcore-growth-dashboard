import { metricMissing, metricOk } from '@growth/shared';
import { describe, expect, it } from 'vitest';
import { formatCount } from '../../lib/format';
import { MISSING_LABELS, metricText } from './metricText';

describe('metricText', () => {
  it('writes a number with the format it is given', () => {
    expect(metricText(metricOk(12_900), formatCount)).toEqual({ text: '12.9K', missing: false });
  });

  it('writes a real zero as a number', () => {
    expect(metricText(metricOk(0), formatCount)).toEqual({ text: '0', missing: false });
  });

  it.each(Object.entries(MISSING_LABELS))('writes %s in words, never as 0', (state, words) => {
    const result = metricText(metricMissing(state as keyof typeof MISSING_LABELS), formatCount);

    expect(result).toEqual({ text: words, missing: true });
    expect(result.text).not.toMatch(/^\d/);
  });

  it('uses the words the product rules name', () => {
    expect(MISSING_LABELS).toEqual({
      not_connected: 'Not connected',
      no_measured_attribution: 'No measured attribution available',
      not_enough_data: 'Not enough data',
      in_progress: 'In progress',
    });
  });
});
