import { describe, expect, it } from 'vitest';
import { channelOf, isReported } from './channels';

const of = (source: string, medium: string, group = '') => channelOf({ source, medium, group });

describe('channelOf', () => {
  it('keeps the source name for social', () => {
    expect(of('Instagram', 'social')).toEqual({ channel: 'social', source: 'instagram' });
    expect(of('tiktok', 'cpc', 'Paid Social')).toEqual({ channel: 'social', source: 'tiktok' });
  });

  it('calls the Play Store and direct visits organic', () => {
    expect(of('google-play', 'organic').channel).toBe('organic');
    expect(of('(direct)', '(none)', 'Direct').channel).toBe('organic');
  });

  it('separates paid Google, referrals and everything else', () => {
    expect(of('google', 'cpc', 'Paid Search').channel).toBe('google');
    expect(of('someblog.com', 'referral').channel).toBe('referral');
    expect(of('newsletter', 'email').channel).toBe('other');
  });
});

describe('isReported', () => {
  it('treats GA4 placeholders as not reported', () => {
    expect(isReported('(not set)')).toBe(false);
    expect(isReported('(organic)')).toBe(false);
    expect(isReported('grindquest_launch')).toBe(true);
  });
});
