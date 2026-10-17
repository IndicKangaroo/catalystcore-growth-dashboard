import { z } from 'zod';

/**
 * Single source of truth for enums (AGENTS.md: define once, never redefine in web or api).
 * Each list is a tuple of string literals, with a matching Zod schema, TS type and label map.
 */

// How an attribution number was obtained (D-002, D-007).
export const PROVENANCE = ['measured', 'inferred', 'manual'] as const;
export const provenanceSchema = z.enum(PROVENANCE);
export type Provenance = z.infer<typeof provenanceSchema>;
export const PROVENANCE_LABELS: Record<Provenance, string> = {
  measured: 'Measured',
  inferred: 'Inferred',
  manual: 'Manual',
};

export const ROLES = ['admin', 'growth', 'developer'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  growth: 'Growth / Social',
  developer: 'Developer',
};

export const APP_STATUSES = ['development', 'testing', 'production'] as const;
export const appStatusSchema = z.enum(APP_STATUSES);
export type AppStatus = z.infer<typeof appStatusSchema>;
export const APP_STATUS_LABELS: Record<AppStatus, string> = {
  development: 'Development',
  testing: 'Testing',
  production: 'Production',
};

export const PLATFORMS = ['instagram', 'pinterest', 'youtube', 'reddit', 'other'] as const;
export const platformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof platformSchema>;
export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  reddit: 'Reddit',
  other: 'Other',
};

export const CONTENT_TYPES = ['reel', 'post', 'pin', 'short', 'thread', 'other'] as const;
export const contentTypeSchema = z.enum(CONTENT_TYPES);
export type ContentType = z.infer<typeof contentTypeSchema>;
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  reel: 'Reel',
  post: 'Post',
  pin: 'Pin',
  short: 'Short',
  thread: 'Thread',
  other: 'Other',
};

// Content categories from PRD section 13.
export const CONTENT_CATEGORIES = [
  'product_demo',
  'feature',
  'educational',
  'behind_the_scenes',
  'founder_story',
  'update',
  'meme',
  'tutorial',
  'user_problem',
  'launch',
  'promotional',
] as const;
export const contentCategorySchema = z.enum(CONTENT_CATEGORIES);
export type ContentCategory = z.infer<typeof contentCategorySchema>;
export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = {
  product_demo: 'Product Demo',
  feature: 'Feature',
  educational: 'Educational',
  behind_the_scenes: 'Behind the Scenes',
  founder_story: 'Founder Story',
  update: 'Update',
  meme: 'Meme',
  tutorial: 'Tutorial',
  user_problem: 'User Problem',
  launch: 'Launch',
  promotional: 'Promotional',
};

// Timeline event types (PRD section 11).
export const EVENT_TYPES = ['post', 'campaign', 'release', 'feature', 'ad', 'other'] as const;
export const eventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof eventTypeSchema>;
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  post: 'Social post',
  campaign: 'Campaign',
  release: 'App release',
  feature: 'Feature launch',
  ad: 'Advertising',
  other: 'Other',
};

// Which analytics source the API reads from (D-003).
export const ANALYTICS_PROVIDERS = ['seed', 'ga4'] as const;
export const analyticsProviderSchema = z.enum(ANALYTICS_PROVIDERS);
export type AnalyticsProviderName = z.infer<typeof analyticsProviderSchema>;
// "Demo data" is the label D-003 requires wherever the seed provider's numbers are shown.
export const ANALYTICS_PROVIDER_LABELS: Record<AnalyticsProviderName, string> = {
  seed: 'Demo data',
  ga4: 'Google Analytics 4',
};

// Quick date ranges for the global filter (PRD section 4). "Custom" is not a preset: a custom range
// carries its own dates.
export const DATE_PRESETS = ['today', '7d', '30d', '90d'] as const;
export const datePresetSchema = z.enum(DATE_PRESETS);
export type DatePreset = z.infer<typeof datePresetSchema>;
export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

// Why a number is missing. A missing number is a state with a reason, never zero (AGENTS.md).
export const METRIC_STATES = [
  'ok',
  'not_connected',
  'no_measured_attribution',
  'not_enough_data',
  'in_progress',
] as const;
export const metricStateSchema = z.enum(METRIC_STATES);
export type MetricState = z.infer<typeof metricStateSchema>;
export const METRIC_STATE_LABELS: Record<MetricState, string> = {
  ok: 'Available',
  not_connected: 'Not connected',
  no_measured_attribution: 'No measured attribution available',
  not_enough_data: 'Not enough data',
  in_progress: 'In progress',
};

// Metrics that can be drawn over time (PRD sections 4 and 6). Revenue joins when a provider can
// report it (D-013).
export const METRICS = [
  'active_users',
  'new_users',
  'sessions',
  'engagement_time',
  'attributed_users',
] as const;
export const metricSchema = z.enum(METRICS);
export type Metric = z.infer<typeof metricSchema>;
export const METRIC_LABELS: Record<Metric, string> = {
  active_users: 'Active users',
  new_users: 'New users',
  sessions: 'Sessions',
  engagement_time: 'Engagement time per user',
  attributed_users: 'Attributed users (measured)',
};

// Acquisition channels from PRD section 7.
export const ACQUISITION_CHANNELS = ['organic', 'social', 'google', 'referral', 'other'] as const;
export const acquisitionChannelSchema = z.enum(ACQUISITION_CHANNELS);
export type AcquisitionChannel = z.infer<typeof acquisitionChannelSchema>;
export const ACQUISITION_CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  organic: 'Organic',
  social: 'Social',
  google: 'Google',
  referral: 'Referral',
  other: 'Other',
};
