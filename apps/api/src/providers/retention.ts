import { addDays, metricMissing, metricOk, mondayOnOrBefore } from '@growth/shared';
import type { DateRange, MetricValue, RetentionCells, RetentionCohort } from '@growth/shared';

/**
 * The conventions every provider follows for retention, so the screens read the same whichever one
 * is behind them: weekly install cohorts that run Monday to Sunday (D-006, D-014), a figure only
 * once its window has ended, and no figure for a cohort too small to mean anything.
 */

/** A cohort with fewer users than this is "not enough data", not a percentage. */
export const MIN_COHORT_USERS = 30;

/** The Monday of every week that overlaps the range, oldest first. */
export function weeklyCohortStarts(range: DateRange): string[] {
  const starts: string[] = [];
  for (let start = mondayOnOrBefore(range.from); start <= range.to; start = addDays(start, 7)) {
    starts.push(start);
  }
  return starts;
}

/**
 * Day N retention for a weekly cohort is measured N days after each person arrived, so it is final
 * once N days have passed since the cohort's last day, which is when its last arrival is measured.
 * Until then it is `in_progress`: a figure computed early would look low, and would be wrong.
 */
export function retentionWindowEnded(cohortEnd: string, day: number, today: string): boolean {
  return addDays(cohortEnd, day) < today;
}

export interface RetentionCellInput {
  cohortEnd: string;
  day: number;
  today: string;
  users: number;
  /** The retention a provider measured or made up, as a fraction from 0 to 1. */
  fraction: number;
}

/** One retention figure for one cohort: a number, or the reason there is not one. */
export function retentionCell(input: RetentionCellInput): MetricValue {
  if (!retentionWindowEnded(input.cohortEnd, input.day, input.today)) {
    return metricMissing('in_progress');
  }
  if (input.users < MIN_COHORT_USERS) return metricMissing('not_enough_data');
  return metricOk(input.fraction);
}

const roundFraction = (value: number) => Math.round(value * 10000) / 10000;

/**
 * Pools one figure across cohorts, weighted by cohort size. Cohorts whose figure is not available
 * are left out of the average; when none has one, the state says why: still in progress if any
 * window has yet to end, otherwise not enough data.
 */
export function poolRetention(rows: { users: number; value: MetricValue }[]): MetricValue {
  let users = 0;
  let weighted = 0;
  let inProgress = false;
  for (const row of rows) {
    if (row.value.state === 'ok') {
      users += row.users;
      weighted += row.users * row.value.value;
    } else if (row.value.state === 'in_progress') {
      inProgress = true;
    }
  }
  if (users > 0) return metricOk(roundFraction(weighted / users));
  return metricMissing(inProgress ? 'in_progress' : 'not_enough_data');
}

/** Day 1, 7, 14 and 30 pooled across cohorts. */
export function poolCells(cohorts: RetentionCohort[]): RetentionCells {
  const pool = (pick: (cells: RetentionCells) => MetricValue) =>
    poolRetention(
      cohorts.map((cohort) => ({ users: cohort.users, value: pick(cohort.retention) })),
    );
  return {
    d1: pool((cells) => cells.d1),
    d7: pool((cells) => cells.d7),
    d14: pool((cells) => cells.d14),
    d30: pool((cells) => cells.d30),
  };
}
