import { z } from 'zod';
import { rangeProblem, resolveDateRange } from './dateRange';
import type { RangeSpec } from './dateRange';
import { calendarDateSchema } from './dates';
import { contentTypeSchema, datePresetSchema, platformSchema } from './enums';
import type { ContentType, DatePreset, Platform } from './enums';

/**
 * The global filters (PRD section 16) and how they travel. In the browser they live in the address
 * (`?range=7d&appIds=...`), so a link shows what its sender saw. The API takes the same names, with
 * the range already turned into `from` and `to`, on every read (PLAN section 7).
 */

export const FILTER_PARAM_NAMES = [
  'range',
  'from',
  'to',
  'appIds',
  'platform',
  'campaignId',
  'contentType',
] as const;

export const MAX_APP_IDS = 50;
const MAX_ID_LENGTH = 128;

export interface FilterState {
  range: RangeSpec;
  /** Empty means every app. */
  appIds: string[];
  platform: Platform | null;
  campaignId: string | null;
  contentType: ContentType | null;
}

export function defaultFilters(defaultPreset: DatePreset): FilterState {
  return {
    range: { kind: 'preset', preset: defaultPreset },
    appIds: [],
    platform: null,
    campaignId: null,
    contentType: null,
  };
}

function splitIds(value: string | null | undefined): string[] {
  if (!value) return [];
  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= MAX_ID_LENGTH);
  return [...new Set(ids)];
}

function readRange(params: URLSearchParams, defaultPreset: DatePreset): RangeSpec {
  const range = params.get('range');
  const preset = datePresetSchema.safeParse(range);
  if (preset.success) return { kind: 'preset', preset: preset.data };

  if (range === 'custom') {
    const from = calendarDateSchema.safeParse(params.get('from'));
    const to = calendarDateSchema.safeParse(params.get('to'));
    if (from.success && to.success && rangeProblem({ from: from.data, to: to.data }) === null) {
      return { kind: 'custom', from: from.data, to: to.data };
    }
  }
  return { kind: 'preset', preset: defaultPreset };
}

/**
 * Reads the filters from an address. Anything it does not understand (a hand-edited or old link) is
 * ignored, so a bad address shows the default view instead of an error.
 */
export function parseFilters(params: URLSearchParams, defaultPreset: DatePreset): FilterState {
  const platform = platformSchema.safeParse(params.get('platform'));
  const contentType = contentTypeSchema.safeParse(params.get('contentType'));
  const campaignId = params.get('campaignId')?.trim() ?? '';

  return {
    range: readRange(params, defaultPreset),
    appIds: splitIds(params.get('appIds')).slice(0, MAX_APP_IDS),
    platform: platform.success ? platform.data : null,
    campaignId: campaignId.length > 0 && campaignId.length <= MAX_ID_LENGTH ? campaignId : null,
    contentType: contentType.success ? contentType.data : null,
  };
}

/** The shortest address that means this state: the default range and "all" are left out. */
export function filtersToParams(state: FilterState, defaultPreset: DatePreset): URLSearchParams {
  const params = new URLSearchParams();
  if (state.range.kind === 'custom') {
    params.set('range', 'custom');
    params.set('from', state.range.from);
    params.set('to', state.range.to);
  } else if (state.range.preset !== defaultPreset) {
    params.set('range', state.range.preset);
  }
  if (state.appIds.length > 0) params.set('appIds', state.appIds.join(','));
  if (state.platform) params.set('platform', state.platform);
  if (state.campaignId) params.set('campaignId', state.campaignId);
  if (state.contentType) params.set('contentType', state.contentType);
  return params;
}

/** Replaces the filter names in an address and leaves every other parameter alone. */
export function mergeFilterParams(
  current: URLSearchParams,
  state: FilterState,
  defaultPreset: DatePreset,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const name of FILTER_PARAM_NAMES) next.delete(name);
  for (const [name, value] of filtersToParams(state, defaultPreset)) next.append(name, value);
  return next;
}

/** The query string for an API read: the range as days in the studio's time zone, plus the rest. */
export function toApiQuery(state: FilterState, now: Date, timeZone: string): URLSearchParams {
  const { from, to } = resolveDateRange(state.range, now, timeZone);
  const params = new URLSearchParams({ from, to });
  if (state.appIds.length > 0) params.set('appIds', state.appIds.join(','));
  if (state.platform) params.set('platform', state.platform);
  if (state.campaignId) params.set('campaignId', state.campaignId);
  if (state.contentType) params.set('contentType', state.contentType);
  return params;
}

/**
 * What every analytics read accepts (PLAN section 7). Strict where the address parser is forgiving:
 * a request that cannot be understood is answered with what is wrong with it.
 */
export const analyticsQuerySchema = z
  .object({
    from: calendarDateSchema,
    to: calendarDateSchema,
    appIds: z
      .string()
      .optional()
      .transform((value) => splitIds(value))
      .refine((ids) => ids.length <= MAX_APP_IDS, {
        message: `Choose at most ${MAX_APP_IDS} apps`,
      }),
    platform: platformSchema.optional(),
    campaignId: z.string().trim().min(1).max(MAX_ID_LENGTH).optional(),
    contentType: contentTypeSchema.optional(),
  })
  .superRefine((query, context) => {
    const problem = rangeProblem(query);
    if (problem) context.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ['to'] });
  });
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
