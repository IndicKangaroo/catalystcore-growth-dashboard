import { addDays, daysBetween, weekdayOf } from '@growth/shared';
import type { AppRecord, Platform } from '@growth/shared';
import { between, jitter } from './random';

/**
 * The made-up world behind the demo data. Every figure is a function of the app's id and the day,
 * so it is the same on every run, and the figures agree with each other: the daily numbers add up
 * to the totals, and the totals add up to the acquisition table.
 */

/** The social platforms the demo brings people from, in the order their weights are listed. */
export const SOCIAL_SOURCES: Exclude<Platform, 'other'>[] = [
  'instagram',
  'youtube',
  'pinterest',
  'reddit',
];

/** Where people who were not matched to a campaign arrive from, in the order of `mixWeights`. */
export const OTHER_CHANNELS = ['organic', 'google', 'referral', 'other'] as const;

/** The day growth is counted from. Any fixed day would do. */
const ANCHOR_DAY = '2026-01-01';

/**
 * How fast the number of different returning people grows with the number of days looked at.
 * Seven days of an app hold far fewer than seven times one day's people, because most of them are
 * the same people coming back.
 */
const RETURNING_REACH = 0.45;

export interface Profile {
  /** Typical daily active users on the anchor day. */
  baseUsers: number;
  /** How fast the user base grows (or shrinks) each day, as a fraction. */
  dailyGrowth: number;
  /** How busy Saturday and Sunday are compared with a weekday. */
  weekendLift: number;
  /** New users as a share of the day's active users. */
  newShare: number;
  sessionsPerUser: number;
  /** Average seconds each active user spends engaged in a day. */
  engagementSeconds: number;
  /** The share of new users matched to a registered campaign. */
  attributedShare: number;
  day1Retention: number;
  mixWeights: number[];
  socialWeights: number[];
}

function buildProfile(appId: string): Profile {
  const key = (field: string) => `${appId}|profile|${field}`;
  return {
    baseUsers: Math.round(Math.exp(between(key('base'), Math.log(250), Math.log(6000)))),
    dailyGrowth: between(key('growth'), -0.0004, 0.0018),
    weekendLift: between(key('weekend'), 0.85, 1.2),
    newShare: between(key('new'), 0.05, 0.15),
    sessionsPerUser: between(key('sessions'), 1.3, 3.4),
    engagementSeconds: between(key('engagement'), 80, 420),
    attributedShare: between(key('attributed'), 0.04, 0.15),
    day1Retention: between(key('d1'), 0.22, 0.45),
    mixWeights: [
      between(key('organic'), 0.45, 0.7),
      between(key('google'), 0.1, 0.3),
      between(key('referral'), 0.03, 0.1),
      between(key('other'), 0.02, 0.06),
    ],
    socialWeights: [
      between(key('instagram'), 0.3, 0.5),
      between(key('youtube'), 0.2, 0.35),
      between(key('pinterest'), 0.05, 0.2),
      between(key('reddit'), 0.05, 0.15),
    ],
  };
}

const profiles = new Map<string, Profile>();

export function profileFor(app: AppRecord): Profile {
  let profile = profiles.get(app.id);
  if (!profile) {
    profile = buildProfile(app.id);
    profiles.set(app.id, profile);
  }
  return profile;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const round4 = (value: number) => Math.round(value * 10000) / 10000;

/** One app's figures for one day. */
export interface DayValues {
  active: number;
  newUsers: number;
  sessions: number;
  engagementSeconds: number;
  attributedUsers: number;
}

/**
 * The app's figures for a day, or null when there are none: before the app launched, or after
 * today, which has not happened yet. A day without data is not a day with zero users.
 */
export function dayValues(app: AppRecord, date: string, today: string): DayValues | null {
  if (date > today) return null;
  if (app.launchDate !== null && date < app.launchDate) return null;

  const profile = profileFor(app);
  const key = (field: string) => `${app.id}|${date}|${field}`;
  const weekday = weekdayOf(date);
  const lift = weekday === 0 || weekday === 6 ? profile.weekendLift : 1;
  const trend = Math.exp(profile.dailyGrowth * daysBetween(ANCHOR_DAY, date));

  const active = Math.max(
    1,
    Math.round(jitter(key('active'), profile.baseUsers * trend * lift, 0.08)),
  );
  const newUsers = Math.round(jitter(key('new'), active * profile.newShare, 0.15));
  return {
    active,
    newUsers,
    sessions: Math.round(jitter(key('sessions'), active * profile.sessionsPerUser, 0.05)),
    engagementSeconds: round1(jitter(key('engagement'), profile.engagementSeconds, 0.06)),
    attributedUsers: Math.round(jitter(key('attributed'), newUsers * profile.attributedShare, 0.2)),
  };
}

/** The days from `from` to `to` that have figures, oldest first. */
export function valuesBetween(
  app: AppRecord,
  from: string,
  to: string,
  today: string,
): DayValues[] {
  const values: DayValues[] = [];
  const last = to < today ? to : today;
  for (let date = from; date <= last; date = addDays(date, 1)) {
    const day = dayValues(app, date, today);
    if (day) values.push(day);
  }
  return values;
}

/** One app's figures over several days. */
export interface Totals {
  /** How many of the days had figures. */
  days: number;
  newUsers: number;
  sessions: number;
  attributedUsers: number;
  /** Different people active in the window, new and returning, counted once each. */
  activeUsers: number;
  /** Average seconds per active user per day, weighted by each day's users. */
  engagementSeconds: number;
}

/** Adds up days. Null when there are none, so "no data" can never pass for zero. */
export function totalsOf(values: DayValues[]): Totals | null {
  if (values.length === 0) return null;

  let newUsers = 0;
  let sessions = 0;
  let attributedUsers = 0;
  let returning = 0;
  let active = 0;
  let engagement = 0;
  for (const day of values) {
    newUsers += day.newUsers;
    sessions += day.sessions;
    attributedUsers += day.attributedUsers;
    returning += day.active - day.newUsers;
    active += day.active;
    engagement += day.active * day.engagementSeconds;
  }

  // New people are new once; the people who come back overlap from one day to the next.
  const meanReturning = returning / values.length;
  return {
    days: values.length,
    newUsers,
    sessions,
    attributedUsers,
    activeUsers: newUsers + Math.round(meanReturning * values.length ** RETURNING_REACH),
    engagementSeconds: Math.round(engagement / active),
  };
}

/** Retention for one weekly cohort on days 1, 7, 14 and 30, each lower than the one before. */
export function retentionFractions(app: AppRecord, cohortStart: string) {
  const key = (field: string) => `${app.id}|cohort|${cohortStart}|${field}`;
  const day1 = Math.min(0.9, Math.max(0.05, jitter(key('d1'), profileFor(app).day1Retention, 0.1)));
  const day7 = day1 * between(key('d7'), 0.38, 0.5);
  const day14 = day7 * between(key('d14'), 0.75, 0.88);
  const day30 = day14 * between(key('d30'), 0.65, 0.8);
  return { d1: round4(day1), d7: round4(day7), d14: round4(day14), d30: round4(day30) };
}
