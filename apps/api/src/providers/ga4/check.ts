import { addDays } from '@growth/shared';
import type { AppRecord, MetricValue } from '@growth/shared';
import { createGa4Provider } from './index';
import type { Ga4Client } from './types';

export interface CheckLine {
  ok: boolean;
  text: string;
}

const show = (value: MetricValue): string =>
  value.state === 'ok' ? String(value.value) : `(${value.state})`;

/**
 * The manual verification the person runs against a real property (`npm run ga4:check`). It makes
 * the same reads the dashboard makes and says in plain words what came back, or what to fix. It
 * prints counts only: no key material, no user-level data.
 */
export async function runGa4Check(
  client: Ga4Client,
  propertyId: string,
  today: string,
): Promise<CheckLine[]> {
  const provider = createGa4Provider({ client });
  const app = {
    id: 'check',
    name: `property ${propertyId}`,
    ga4PropertyId: propertyId,
  } as AppRecord;
  const period = { from: addDays(today, -28), to: addDays(today, -1) };
  const query = { period, today };
  const lines: CheckLine[] = [];

  const step = async (name: string, run: () => Promise<string>) => {
    try {
      lines.push({ ok: true, text: `${name}: ${await run()}` });
      return true;
    } catch (err) {
      lines.push({
        ok: false,
        text: `${name}: ${err instanceof Error ? err.message : String(err)}`,
      });
      return false;
    }
  };

  // Access comes first: if this fails, every later step would fail the same way.
  const reachable = await step('Connection and users', async () => {
    const users = await provider.getAppUsers(app, query);
    return `${period.from} to ${period.to}: new users ${show(users.newUsers)}, sessions ${show(users.sessions)}, DAU ${show(users.dau)}, WAU ${show(users.wau)}, MAU (28-day) ${show(users.mau)}`;
  });
  if (!reachable) return lines;

  await step('Retention (weekly install cohorts)', async () => {
    const retention = await provider.getRetention(app, query);
    const s = retention.summary;
    return `${retention.cohorts.length} cohorts; D1 ${show(s.d1)}, D7 ${show(s.d7)}, D14 ${show(s.d14)}, D30 ${show(s.d30)} (fractions; in_progress is expected for recent weeks)`;
  });

  await step('Acquisition by source', async () => {
    const acquisition = await provider.getAcquisition({ ...query, apps: [app] });
    if (acquisition.data.state !== 'ok') return `(${acquisition.data.state})`;
    const top = acquisition.data.rows
      .slice(0, 5)
      .map((row) => `${row.channel}${row.source ? `/${row.source}` : ''} ${row.users}`)
      .join(', ');
    return `${acquisition.data.rows.length} rows (${top}); campaign details reported: ${acquisition.data.measuredAttribution ? 'yes' : 'no (see D-007)'}`;
  });

  await step('Daily series', async () => {
    const series = await provider.getTimeSeries({ ...query, apps: [app] }, 'active_users');
    if (series.data.state !== 'ok') return `(${series.data.state})`;
    const withData = series.data.points.filter((point) => point.value !== null).length;
    return `${withData} of ${series.data.points.length} days have data`;
  });

  return lines;
}

export const allPassed = (lines: CheckLine[]) => lines.every((line) => line.ok);
