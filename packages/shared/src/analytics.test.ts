import { describe, expect, it } from 'vitest';
import {
  acquisitionSchema,
  campaignOutcomeSchema,
  metricMissing,
  metricOk,
  metricValueSchema,
  overviewSchema,
  seriesSchema,
} from './analytics';
import { METRIC_STATE_LABELS, METRIC_STATES } from './enums';

describe('metricValueSchema', () => {
  it('reads a value, and each way a value can be missing', () => {
    expect(metricValueSchema.parse({ state: 'ok', value: 12 })).toEqual({ state: 'ok', value: 12 });
    for (const state of METRIC_STATES.filter((entry) => entry !== 'ok')) {
      expect(metricValueSchema.parse({ state })).toEqual({ state });
    }
  });

  it('keeps zero as a value, not as a missing number', () => {
    expect(metricValueSchema.parse(metricOk(0))).toEqual({ state: 'ok', value: 0 });
  });

  it('refuses an ok without a value, and a missing state that carries one', () => {
    expect(metricValueSchema.safeParse({ state: 'ok' }).success).toBe(false);
    expect(metricValueSchema.parse({ state: 'not_connected', value: 0 })).toEqual({
      state: 'not_connected',
    });
    expect(metricValueSchema.safeParse({ state: 'unknown' }).success).toBe(false);
  });

  it('has a label for every state', () => {
    for (const state of METRIC_STATES) {
      expect(METRIC_STATE_LABELS[state].length).toBeGreaterThan(0);
    }
    expect(METRIC_STATE_LABELS.not_connected).toBe('Not connected');
    expect(METRIC_STATE_LABELS.no_measured_attribution).toBe('No measured attribution available');
    expect(METRIC_STATE_LABELS.in_progress).toBe('In progress');
    expect(METRIC_STATE_LABELS.not_enough_data).toBe('Not enough data');
  });
});

describe('metricMissing', () => {
  it('builds a value that says why there is none', () => {
    expect(metricMissing('in_progress')).toEqual({ state: 'in_progress' });
    expect(metricValueSchema.parse(metricMissing('not_connected'))).toEqual({
      state: 'not_connected',
    });
  });
});

const range = { from: '2026-10-01', to: '2026-10-14' };

describe('overviewSchema', () => {
  it('reads an overview in which some numbers are missing', () => {
    const overview = {
      source: 'seed',
      range,
      appsWithData: 2,
      appsNotConnected: ['app-3'],
      activeUsers: metricOk(1200),
      newUsers: metricOk(300),
      sessions: metricOk(5000),
      installs: metricMissing('not_connected'),
      averageRetention: metricOk(0.18),
      revenue: metricMissing('not_connected'),
      attributedUsers: metricMissing('no_measured_attribution'),
    };
    expect(overviewSchema.parse(overview)).toEqual(overview);
  });

  it('refuses a range that ends before it starts', () => {
    const result = overviewSchema.safeParse({
      source: 'seed',
      range: { from: '2026-10-14', to: '2026-10-01' },
    });
    expect(result.success).toBe(false);
  });
});

describe('seriesSchema', () => {
  it('keeps a day without data as null, not zero', () => {
    const series = {
      source: 'seed',
      metric: 'new_users',
      range,
      data: {
        state: 'ok',
        points: [
          { date: '2026-10-01', value: 10 },
          { date: '2026-10-02', value: null },
          { date: '2026-10-03', value: 0 },
        ],
      },
    };
    expect(seriesSchema.parse(series)).toEqual(series);
  });

  it('reads a series that is missing as a whole', () => {
    const series = {
      source: 'ga4',
      metric: 'attributed_users',
      range,
      data: { state: 'no_measured_attribution' },
    };
    expect(seriesSchema.parse(series)).toEqual(series);
  });
});

describe('acquisitionSchema', () => {
  it('requires a provenance on every row', () => {
    const rows = [{ channel: 'social', source: 'instagram', users: 40 }];
    const result = acquisitionSchema.safeParse({
      source: 'seed',
      range,
      data: { state: 'ok', rows, measuredAttribution: true },
    });
    expect(result.success).toBe(false);
  });

  it('reads rows of all three provenances', () => {
    const rows = [
      { channel: 'social', source: 'instagram', users: 40, provenance: 'measured' },
      { channel: 'social', source: null, users: 12, provenance: 'inferred' },
      { channel: 'referral', source: 'blog', users: 5, provenance: 'manual' },
    ];
    const answer = {
      source: 'seed',
      range,
      data: { state: 'ok', rows, measuredAttribution: true },
    };
    expect(acquisitionSchema.parse(answer)).toEqual(answer);
  });
});

describe('campaignOutcomeSchema', () => {
  it('only ever reports measured attribution', () => {
    const base = {
      source: 'seed',
      range,
      utm: { source: 'instagram', medium: 'social', campaign: 'launch', content: 'reel_01' },
      attributedUsers: metricOk(20),
      engagedUsers: metricOk(12),
      retainedUsers: metricMissing('in_progress'),
    };
    expect(campaignOutcomeSchema.safeParse({ ...base, provenance: 'measured' }).success).toBe(true);
    expect(campaignOutcomeSchema.safeParse({ ...base, provenance: 'inferred' }).success).toBe(
      false,
    );
  });
});
