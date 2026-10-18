import { APP_STATUS_LABELS, DATE_PRESET_LABELS } from '@growth/shared';
import type { AppRecord, AppStatus, MetricValue, Overview } from '@growth/shared';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import type { ChipTone } from '../../components/Chip';
import { LogoTile } from '../../components/LogoTile';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { ProvenanceBadge } from '../../components/ProvenanceBadge';
import { SourceLabel } from '../../components/SourceLabel';
import { formatCount, formatPercent } from '../../lib/format';
import { useApps } from '../apps/queries';
import { useSession } from '../auth/session';
import { filterSearch } from '../filters/filters';
import { useFilters } from '../filters/useFilters';
import { CompareControl } from '../metrics/CompareControl';
import { GrowthCard } from '../metrics/GrowthCard';
import { MetricCard, comparisonFrom } from '../metrics/MetricCard';
import { useOverview, useViewQueries } from '../metrics/queries';
import { useCompare } from '../metrics/useCompare';
import { useStudio } from '../studio/studio';

const STATUS_TONES: Record<AppStatus, ChipTone> = {
  development: 'neutral',
  testing: 'warn',
  production: 'ok',
};

function NoApps() {
  const { can } = useSession();
  const [params] = useSearchParams();

  return (
    <Card className="flex flex-col items-start gap-2 p-6">
      <h2 className="text-base font-semibold text-fg">No apps yet</h2>
      <p className="text-sm text-fg-muted">
        {can('apps:write')
          ? 'Add the apps this studio tracks to start.'
          : 'An admin has to add the apps this studio tracks.'}
      </p>
      <Link
        to={{ pathname: '/apps', search: filterSearch(params) }}
        className="text-sm font-medium text-accent hover:underline"
      >
        Go to Apps
      </Link>
    </Card>
  );
}

/** The apps the numbers cover, each linking to its own page. */
function AppsInView({ apps, chosen }: { apps: AppRecord[]; chosen: string[] }) {
  const [params] = useSearchParams();
  const shown = chosen.length === 0 ? apps : apps.filter((app) => chosen.includes(app.id));

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-base font-semibold tracking-tight text-fg">Apps in this view</h2>
      <p className="mt-0.5 text-xs text-fg-subtle">
        {chosen.length === 0 ? 'All apps' : 'The apps you chose'}. Open one for its users and
        retention.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {shown.map((app) => (
          <li key={app.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <LogoTile name={app.name} imageUrl={app.iconUrl} soft />
              <div className="min-w-0">
                <Link
                  to={{ pathname: `/apps/${app.id}`, search: filterSearch(params) }}
                  className="font-semibold text-fg hover:text-accent hover:underline"
                >
                  {app.name}
                </Link>
                <p className="truncate font-mono text-[11px] text-fg-subtle">{app.packageName}</p>
              </div>
            </div>
            <Chip tone={STATUS_TONES[app.status]} dot>
              {APP_STATUS_LABELS[app.status]}
            </Chip>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The landing screen: the key numbers for the days and apps chosen, the growth chart, and the apps
 * behind them. Every number comes from the analytics provider, and the screen says which one
 * (D-036). A number that cannot be given is written as the reason, never as zero.
 */
export default function OverviewPage() {
  const { state } = useSession();
  const { settings, configured } = useStudio();
  const { filters } = useFilters();
  const { compare } = useCompare();
  const apps = useApps();
  const queries = useViewQueries();
  const hasApps = apps.data === undefined || apps.data.length > 0;
  const overview = useOverview(queries.current, hasApps);
  const before = useOverview(queries.before, hasApps && compare);
  const who = state.status === 'ready' ? (state.user.name ?? state.user.email) : '';
  const against = (pick: (data: Overview) => MetricValue) => comparisonFrom(compare, before, pick);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description={`Welcome, ${who}. How your apps are doing over the days you chose.`}
        actions={
          <>
            {overview.data && <SourceLabel source={overview.data.source} />}
            <CompareControl />
          </>
        }
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

      {apps.data?.length === 0 ? (
        <NoApps />
      ) : (
        <>
          {overview.isError && <Notice tone="danger">{overview.error.message}</Notice>}
          {overview.isPending && (
            <p role="status" className="text-fg-muted">
              Loading the numbers…
            </p>
          )}
          {overview.data && (
            <section aria-labelledby="key-numbers" className="flex flex-col gap-3">
              <h2 id="key-numbers" className="sr-only">
                Key numbers
              </h2>
              {overview.data.appsNotConnected.length > 0 && (
                <Notice tone="warn">
                  <p className="font-medium">Some apps are not in these numbers.</p>
                  <p>{`Not connected: ${overview.data.appsNotConnected.join(', ')}.`}</p>
                </Notice>
              )}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <MetricCard
                  label="Active users"
                  value={overview.data.activeUsers}
                  format={formatCount}
                  note="Added up across apps"
                  comparison={against((data) => data.activeUsers)}
                />
                <MetricCard
                  label="New users"
                  value={overview.data.newUsers}
                  format={formatCount}
                  comparison={against((data) => data.newUsers)}
                />
                <MetricCard
                  label="Sessions"
                  value={overview.data.sessions}
                  format={formatCount}
                  comparison={against((data) => data.sessions)}
                />
                <MetricCard
                  label="Installs"
                  value={overview.data.installs}
                  format={formatCount}
                  comparison={against((data) => data.installs)}
                />
                <MetricCard
                  label="Day-7 retention"
                  value={overview.data.averageRetention}
                  format={formatPercent}
                  comparison={against((data) => data.averageRetention)}
                />
                <MetricCard
                  label="Attributed users"
                  value={overview.data.attributedUsers}
                  format={formatCount}
                  badge={<ProvenanceBadge provenance="measured" />}
                  comparison={against((data) => data.attributedUsers)}
                />
              </div>
            </section>
          )}

          <GrowthCard title="Growth" />
          {apps.data && <AppsInView apps={apps.data} chosen={filters.appIds} />}
        </>
      )}
    </div>
  );
}
