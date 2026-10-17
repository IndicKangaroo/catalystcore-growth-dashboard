import { APP_STATUS_LABELS } from '@growth/shared';
import type { AppRecord, AppStatus } from '@growth/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import type { ChipTone } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { LogoTile } from '../../components/LogoTile';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { apiFetch } from '../../lib/api';
import { formatDay } from '../../lib/format';
import { useSession } from '../auth/session';
import { AppForm } from './AppForm';
import { APPS_KEY, useApps } from './queries';

type Adding = { mode: 'add' };
type Editing = { mode: 'edit'; app: AppRecord };
type Editor = Adding | Editing | null;

const STATUS_TONES: Record<AppStatus, ChipTone> = {
  development: 'neutral',
  testing: 'warn',
  production: 'ok',
};

const HEADER_CELL = 'px-4 py-3';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-3.5">
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="mt-1 text-[28px] leading-8 font-semibold tracking-tight text-fg tabular-nums">
        {value}
      </dd>
    </Card>
  );
}

function Ga4Cell({ app }: { app: AppRecord }) {
  if (!app.ga4PropertyId) {
    return (
      <Chip tone="warn" dot>
        Not connected
      </Chip>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Chip
        tone="accent"
        title="The property ID is saved. Testing the connection comes with the GA4 provider."
      >
        GA4 property set
      </Chip>
      <span className="font-mono text-[11px] text-fg-subtle">{app.ga4PropertyId}</span>
    </div>
  );
}

interface AppRowProps {
  app: AppRecord;
  canWrite: boolean;
  isBeingEdited: boolean;
  confirmingDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function AppRow({
  app,
  canWrite,
  isBeingEdited,
  confirmingDelete,
  busy,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: AppRowProps) {
  return (
    <tr className={isBeingEdited ? 'bg-accent/5' : undefined}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <LogoTile name={app.name} imageUrl={app.iconUrl} soft />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-fg">{app.name}</span>
              {app.currentVersion && <Chip mono>{app.currentVersion}</Chip>}
              {app.category && <Chip>{app.category}</Chip>}
              {app.playStoreUrl && (
                <a
                  href={app.playStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${app.name} on Google Play`}
                  className="text-fg-subtle hover:text-accent"
                >
                  <Icon name="external" />
                </a>
              )}
            </div>
            <p className="font-mono text-xs text-fg-subtle">{app.packageName}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <Chip tone={STATUS_TONES[app.status]} dot>
          {APP_STATUS_LABELS[app.status]}
        </Chip>
      </td>
      <td className="px-4 py-2.5">
        <Ga4Cell app={app} />
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap text-fg-muted">
        {app.launchDate ? formatDay(app.launchDate) : 'Not set'}
      </td>
      {canWrite && (
        <td className="px-4 py-2.5">
          {confirmingDelete ? (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs whitespace-nowrap text-fg-muted">Delete this app?</span>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                aria-label={`Confirm delete ${app.name}`}
                onClick={onConfirmDelete}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                aria-label={`Cancel deleting ${app.name}`}
                onClick={onCancelDelete}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Edit ${app.name}`}
                onClick={onEdit}
              >
                <Icon name="pencil" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${app.name}`}
                onClick={onAskDelete}
              >
                <Icon name="trash" />
                Delete
              </Button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

/**
 * The apps this studio tracks. Everyone can read the list; admins add, change and delete apps
 * (the API enforces that, the buttons only follow it). It shows what is stored about each app and
 * whether a GA4 property is set; it shows no analytics numbers, which come in later phases.
 */
export default function AppsPage() {
  const { can } = useSession();
  const canWrite = can('apps:write');
  const apps = useApps();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<Editor>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/apps/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setConfirmingId(null);
      await queryClient.invalidateQueries({ queryKey: APPS_KEY });
    },
  });

  function askDelete(id: string) {
    remove.reset();
    setConfirmingId(id);
  }

  const list = apps.data ?? [];
  const inProduction = list.filter((app) => app.status === 'production').length;
  const withProperty = list.filter((app) => app.ga4PropertyId !== null).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Apps"
        count={apps.data?.length}
        description="The apps this studio tracks. Each one can be connected to its own GA4 property."
        actions={
          canWrite && (
            <Button onClick={() => setEditor({ mode: 'add' })}>
              <Icon name="plus" />
              Add app
            </Button>
          )
        }
      />

      {canWrite && editor && (
        <AppForm
          key={editor.mode === 'edit' ? editor.app.id : 'new'}
          app={editor.mode === 'edit' ? editor.app : undefined}
          onClose={() => setEditor(null)}
        />
      )}

      {remove.error && <Notice tone="danger">{remove.error.message}</Notice>}

      {apps.isPending && (
        <p role="status" className="text-fg-muted">
          Loading apps…
        </p>
      )}

      {apps.isError && (
        <Card className="flex flex-col items-start gap-3 p-5">
          <Notice tone="danger">{apps.error.message}</Notice>
          <Button variant="secondary" onClick={() => void apps.refetch()}>
            Try again
          </Button>
        </Card>
      )}

      {apps.data && list.length === 0 && (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-control bg-muted text-fg-muted">
            <Icon name="apps" size={20} />
          </span>
          <h2 className="text-base font-semibold text-fg">No apps yet</h2>
          <p className="max-w-md text-sm text-fg-muted">
            {canWrite
              ? 'Add the apps this studio tracks. Each one can be connected to its own GA4 property.'
              : 'An admin has to add the apps this studio tracks.'}
          </p>
          {canWrite && (
            <Button onClick={() => setEditor({ mode: 'add' })}>
              <Icon name="plus" />
              Add the first app
            </Button>
          )}
        </Card>
      )}

      {list.length > 0 && (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Apps" value={String(list.length)} />
            <SummaryCard label="In production" value={String(inProduction)} />
            <SummaryCard label="GA4 property set" value={`${withProperty} of ${list.length}`} />
          </dl>

          <Card className="overflow-hidden">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <caption className="sr-only">Apps</caption>
                <thead>
                  <tr className="border-b border-line bg-canvas text-[11px] font-semibold tracking-[0.04em] text-fg-subtle uppercase">
                    <th scope="col" className={HEADER_CELL}>
                      App
                    </th>
                    <th scope="col" className={HEADER_CELL}>
                      Status
                    </th>
                    <th scope="col" className={HEADER_CELL}>
                      GA4 connection
                    </th>
                    <th scope="col" className={HEADER_CELL}>
                      Launched
                    </th>
                    {canWrite && (
                      <th scope="col" className={HEADER_CELL}>
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((app) => (
                    <AppRow
                      key={app.id}
                      app={app}
                      canWrite={canWrite}
                      isBeingEdited={editor?.mode === 'edit' && editor.app.id === app.id}
                      confirmingDelete={confirmingId === app.id}
                      busy={remove.isPending}
                      onEdit={() => {
                        setConfirmingId(null);
                        setEditor({ mode: 'edit', app });
                      }}
                      onAskDelete={() => askDelete(app.id)}
                      onCancelDelete={() => setConfirmingId(null)}
                      onConfirmDelete={() => remove.mutate(app.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
