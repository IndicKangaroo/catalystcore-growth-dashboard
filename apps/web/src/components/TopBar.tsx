import { ROLE_LABELS } from '@growth/shared';
import { DateRangeControl } from '../features/filters/DateRangeControl';
import { DataSourcePill } from '../features/health/DataSourcePill';
import { useSession } from '../features/auth/session';
import { useStudio } from '../features/studio/studio';
import { initialsOf } from '../lib/format';
import { PRODUCT_NAME } from '../lib/product';
import { Button } from './Button';
import { Icon } from './Icon';

interface TopBarProps {
  /** The name of the screen showing, for the "studio / screen" path on the left. */
  pageName: string;
  /** Whether the screen uses the date range, so the control is only offered where it counts. */
  showRange: boolean;
}

/** The 56px bar above every screen: where we are, the data source, the date range, who is here. */
export function TopBar({ pageName, showRange }: TopBarProps) {
  const { state, signOut } = useSession();
  const { settings } = useStudio();
  if (state.status !== 'ready') return null;

  const studioName = settings.name ?? PRODUCT_NAME;
  const who = state.user.name ?? state.user.email;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <p className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className="truncate font-semibold text-fg">{studioName}</span>
            <span aria-hidden="true" className="text-fg-subtle">
              /
            </span>
            <span className="whitespace-nowrap font-medium text-accent">{pageName}</span>
          </p>
          <DataSourcePill />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {showRange && <DateRangeControl />}
          <div className="flex items-center gap-2" title={state.user.email}>
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-fg-muted ring-1 ring-line"
            >
              {initialsOf(who)}
            </span>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="max-w-40 truncate text-xs font-semibold text-fg">{who}</span>
              <span className="text-[11px] text-fg-subtle">{ROLE_LABELS[state.user.role]}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            title="Sign out"
            className="w-8 px-0"
            onClick={() => void signOut()}
          >
            <Icon name="logout" />
          </Button>
        </div>
      </div>
    </header>
  );
}
