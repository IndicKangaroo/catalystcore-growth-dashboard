import type { MetricValue, MissingState } from '@growth/shared';

/**
 * What a number that is missing says instead of a number (AGENTS.md: missing data is a state, not
 * zero). One place, so every screen uses the same words.
 */
export const MISSING_LABELS: Record<MissingState, string> = {
  not_connected: 'Not connected',
  no_measured_attribution: 'No measured attribution available',
  not_enough_data: 'Not enough data',
  in_progress: 'In progress',
};

export interface MetricText {
  text: string;
  /** True when the text is the reason for a missing number and not a number. */
  missing: boolean;
}

/** A number written with `format`, or the words for why there is none. */
export function metricText(value: MetricValue, format: (value: number) => string): MetricText {
  if (value.state === 'ok') return { text: format(value.value), missing: false };
  return { text: MISSING_LABELS[value.state], missing: true };
}
