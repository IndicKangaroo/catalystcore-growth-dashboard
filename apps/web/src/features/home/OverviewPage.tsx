import { ANALYTICS_PROVIDER_LABELS, DATE_PRESET_LABELS } from '@growth/shared';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { formatDayRange } from '../../lib/format';
import { useApps } from '../apps/queries';
import { useSession } from '../auth/session';
import { filterSearch } from '../filters/filters';
import { useFilters } from '../filters/useFilters';
import { useHealth } from '../health/useHealth';
import { useStudio } from '../studio/studio';

function StatusCard({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <h2 className="text-xs font-medium text-fg-muted">{label}</h2>
      <p className="text-xl font-semibold tracking-tight text-fg">{value}</p>
      {children && (
        <div className="mt-1 flex flex-col gap-1 text-xs text-fg-subtle">{children}</div>
      )}
    </Card>
  );
}

function DataSourceCard() {
  const health = useHealth();

  if (health.isPending) return <StatusCard label="Data source" value="Checking…" />;
  if (health.isError) {
    return (
      <StatusCard label="Data source" value="API not reachable">
        <p>{health.error.message}</p>
      </StatusCard>
    );
  }

  const { provider } = health.data;
  return (
    <StatusCard label="Data source" value={ANALYTICS_PROVIDER_LABELS[provider]}>
      {provider === 'seed' ? (
        <p>Generated sample numbers. Real analytics arrive with the GA4 connection.</p>
      ) : (
        <p>Numbers are read from Google Analytics 4.</p>
      )}
    </StatusCard>
  );
}

function AppsCard() {
  const { can } = useSession();
  const [params] = useSearchParams();
  const apps = useApps();
  const manage = { pathname: '/apps', search: filterSearch(params) };

  if (apps.isPending) return <StatusCard label="Apps" value="Loading…" />;
  if (apps.isError) {
    return (
      <StatusCard label="Apps" value="Not available">
        <p>{apps.error.message}</p>
      </StatusCard>
    );
  }

  const total = apps.data.length;
  if (total === 0) {
    return (
      <StatusCard label="Apps" value="No apps yet">
        <p>
          {can('apps:write')
            ? 'Add the apps this studio tracks to start.'
            : 'An admin has to add the apps this studio tracks.'}
        </p>
        <Link to={manage} className="font-medium text-accent hover:underline">
          Go to Apps
        </Link>
      </StatusCard>
    );
  }

  const withProperty = apps.data.filter((app) => app.ga4PropertyId !== null).length;
  return (
    <StatusCard label="Apps" value={total === 1 ? '1 app' : `${total} apps`}>
      <p>{`${withProperty} of ${total} with a GA4 property set`}</p>
      <Link to={manage} className="font-medium text-accent hover:underline">
        Manage apps
      </Link>
    </StatusCard>
  );
}

function CurrentViewCard() {
  const { filters, range, timeZone } = useFilters();
  const label =
    filters.range.kind === 'custom' ? 'Custom range' : DATE_PRESET_LABELS[filters.range.preset];
  const appsText =
    filters.appIds.length === 0
      ? 'All apps'
      : filters.appIds.length === 1
        ? '1 app chosen'
        : `${filters.appIds.length} apps chosen`;

  return (
    <StatusCard label="Current view" value={label}>
      <p>{`${formatDayRange(range)} (${timeZone})`}</p>
      <p>{appsText}</p>
    </StatusCard>
  );
}

/**
 * The landing screen. Until the charts arrive (phase P3) it shows only what the dashboard really
 * knows: where its data comes from, how many apps it tracks, and the view the filters describe. It
 * has no placeholder numbers.
 */
export default function OverviewPage() {
  const { state } = useSession();
  const { settings, configured } = useStudio();
  const who = state.status === 'ready' ? (state.user.name ?? state.user.email) : '';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description={`Welcome, ${who}. The charts and key numbers arrive in the next phase; this page shows what the dashboard is set up with.`}
      />

      {!configured && (
        <Notice tone="warn">
          <p className="font-medium">The studio settings have not been saved yet.</p>
          <p>
            {`The defaults are in use: time zone ${settings.timezone}, currency ${settings.currency}, and ${
              DATE_PRESET_LABELS[settings.defaultDateRange]
            } as the first view. To change them, add a "settings/studio" document in Firestore; the README explains how.`}
          </p>
        </Notice>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <DataSourceCard />
        <AppsCard />
        <CurrentViewCard />
      </div>
    </div>
  );
}
