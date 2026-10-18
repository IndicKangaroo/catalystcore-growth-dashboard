import { APP_STATUS_LABELS } from '@growth/shared';
import type { AppRecord, AppUsers, MetricValue } from '@growth/shared';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { SourceLabel } from '../../components/SourceLabel';
import { formatCount, formatDuration, formatPercent } from '../../lib/format';
import { useApps } from '../apps/queries';
import { filterSearch } from '../filters/filters';
import { CohortHeatmap } from '../metrics/CohortHeatmap';
import { CompareControl } from '../metrics/CompareControl';
import { GrowthCard } from '../metrics/GrowthCard';
import { MetricCard, comparisonFrom } from '../metrics/MetricCard';
import { useAppUsers, useRetention, useViewQueries } from '../metrics/queries';
import { useCompare } from '../metrics/useCompare';

const oneDecimal = (value: number) => (Math.round(value * 10) / 10).toString();

function BackLink() {
  const [params] = useSearchParams();
  return (
    <Link
      to={{ pathname: '/apps', search: filterSearch(params) }}
      className="text-sm font-medium text-accent hover:underline"
    >
      ← All apps
    </Link>
  );
}

function RetentionSection({ appId }: { appId: string }) {
  // The app is named in the address, so the apps chosen in the filters have no say in this read.
  const queries = useViewQueries([]);
  const retention = useRetention(appId, queries.current);

  return (
    <section aria-labelledby="retention-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="retention-heading" className="text-base font-semibold tracking-tight text-fg">
          Retention
        </h2>
        <p className="mt-0.5 text-xs text-fg-subtle">
          The share of new users who came back, by weekly install cohort. A window that has not
          ended yet says &ldquo;In progress&rdquo;; it is not a zero.
        </p>
      </div>

      {retention.isPending && (
        <p role="status" className="text-fg-muted">
          Loading retention…
        </p>
      )}
      {retention.isError && <Notice tone="danger">{retention.error.message}</Notice>}
      {retention.data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              label="Day 1"
              value={retention.data.summary.d1}
              format={formatPercent}
              note="All cohorts in the range"
            />
            <MetricCard
              label="Day 7"
              value={retention.data.summary.d7}
              format={formatPercent}
              note="All cohorts in the range"
            />
            <MetricCard
              label="Day 14"
              value={retention.data.summary.d14}
              format={formatPercent}
              note="All cohorts in the range"
            />
            <MetricCard
              label="Day 30"
              value={retention.data.summary.d30}
              format={formatPercent}
              note="All cohorts in the range"
            />
          </div>
          <Card className="p-2 sm:p-3">
            <CohortHeatmap cohorts={retention.data.cohorts} />
          </Card>
        </>
      )}
    </section>
  );
}

function UsersSection({ app }: { app: AppRecord }) {
  const { compare } = useCompare();
  const queries = useViewQueries([]);
  const users = useAppUsers(app.id, queries.current);
  const before = useAppUsers(app.id, queries.before, compare);
  const against = (pick: (data: AppUsers) => MetricValue) => comparisonFrom(compare, before, pick);

  return (
    <section aria-labelledby="users-heading" className="flex flex-col gap-3">
      <h2 id="users-heading" className="sr-only">
        Users
      </h2>
      {users.isPending && (
        <p role="status" className="text-fg-muted">
          Loading the numbers…
        </p>
      )}
      {users.isError && <Notice tone="danger">{users.error.message}</Notice>}
      {users.data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="DAU"
            value={users.data.dau}
            format={formatCount}
            note="Active on the last day of the range"
            comparison={against((data) => data.dau)}
          />
          <MetricCard
            label="WAU"
            value={users.data.wau}
            format={formatCount}
            note="Active in the 7 days to the last day"
            comparison={against((data) => data.wau)}
          />
          <MetricCard
            label="MAU"
            value={users.data.mau}
            format={formatCount}
            note="Active in the 28 days to the last day"
            comparison={against((data) => data.mau)}
          />
          <MetricCard
            label="New users"
            value={users.data.newUsers}
            format={formatCount}
            comparison={against((data) => data.newUsers)}
          />
          <MetricCard
            label="Returning users"
            value={users.data.returningUsers}
            format={formatCount}
            comparison={against((data) => data.returningUsers)}
          />
          <MetricCard
            label="Sessions"
            value={users.data.sessions}
            format={formatCount}
            comparison={against((data) => data.sessions)}
          />
          <MetricCard
            label="Sessions per user"
            value={users.data.sessionsPerUser}
            format={oneDecimal}
            comparison={against((data) => data.sessionsPerUser)}
          />
          <MetricCard
            label="Engagement per user"
            value={users.data.averageEngagementSeconds}
            format={formatDuration}
            comparison={against((data) => data.averageEngagementSeconds)}
          />
        </div>
      )}
    </section>
  );
}

/**
 * One app: its users, its growth over the chosen days, and its retention. The app comes from the
 * address; every number comes from the analytics provider, and the screen says which one.
 */
export default function AppDetailPage() {
  const { appId = '' } = useParams();
  const apps = useApps();
  const queries = useViewQueries([]);
  const app = apps.data?.find((entry) => entry.id === appId);
  // Nothing is asked for an app that is not in the list, so a wrong address costs no request.
  const users = useAppUsers(appId, queries.current, app !== undefined);

  if (apps.isPending) {
    return (
      <p role="status" className="text-fg-muted">
        Loading the app…
      </p>
    );
  }
  if (apps.isError) return <Notice tone="danger">{apps.error.message}</Notice>;

  if (!app) {
    return (
      <div className="flex flex-col items-start gap-3">
        <PageHeader title="App not found" />
        <Notice tone="warn">
          <p>This app does not exist any more, or the address is wrong.</p>
        </Notice>
        <BackLink />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <PageHeader
        title={app.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs">{app.packageName}</span>
            <Chip dot>{APP_STATUS_LABELS[app.status]}</Chip>
          </span>
        }
        actions={
          <>
            {users.data && <SourceLabel source={users.data.source} />}
            <CompareControl />
          </>
        }
      />
      <UsersSection app={app} />
      <GrowthCard title="Growth" appIds={[app.id]} />
      <RetentionSection appId={app.id} />
    </div>
  );
}
