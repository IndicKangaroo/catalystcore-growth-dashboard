import type { AcquisitionChannel } from '@growth/shared';

/** GA4 writes these where a campaign name, source or medium was not reported. */
const UNREPORTED = new Set(['', '(not set)', '(direct)', '(organic)', '(referral)', '(none)']);

export const isReported = (value: string): boolean => !UNREPORTED.has(value.trim().toLowerCase());

const SOCIAL_MEDIA = new Set(['social', 'social-network', 'social-media', 'sm', 'paid social']);
const PLAY_SOURCES = new Set(['google-play', 'play.google.com', 'googleplay']);
const PAID_MEDIA = new Set(['cpc', 'ppc', 'paid', 'paidsearch']);

export interface FirstUserChannel {
  source: string;
  medium: string;
  /** GA4's own grouping, such as "Organic Social" or "Direct". */
  group: string;
}

/**
 * Which of the studio's channels a new user came through (D-007). Social is recognised from the
 * medium or from GA4's own social grouping; the person's source name is kept as the row name.
 */
export function channelOf(user: FirstUserChannel): {
  channel: AcquisitionChannel;
  source: string | null;
} {
  const source = user.source.trim().toLowerCase();
  const medium = user.medium.trim().toLowerCase();
  const group = user.group.trim().toLowerCase();

  if (SOCIAL_MEDIA.has(medium) || group.includes('social')) {
    return { channel: 'social', source: isReported(source) ? source : null };
  }
  if (source === 'google' && (PAID_MEDIA.has(medium) || group.includes('paid'))) {
    return { channel: 'google', source: null };
  }
  if (medium === 'referral' && !PLAY_SOURCES.has(source)) {
    return { channel: 'referral', source: null };
  }
  if (
    PLAY_SOURCES.has(source) ||
    source === '(direct)' ||
    group === 'direct' ||
    group.startsWith('organic')
  ) {
    return { channel: 'organic', source: null };
  }
  return { channel: 'other', source: null };
}
