import { NavLink, useSearchParams } from 'react-router-dom';
import { filterSearch } from '../features/filters/filters';
import { useStudio } from '../features/studio/studio';
import { PRODUCT_NAME } from '../lib/product';
import { Icon } from './Icon';
import { LogoTile } from './LogoTile';
import { ThemeToggle } from './ThemeToggle';
import type { NavItem } from './navigation';

const LINK_BASE =
  'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control px-2 py-2 text-[13px] font-medium transition-colors lg:gap-2.5 lg:px-2.5';

/**
 * The left rail: the studio's brand, the menu, and the theme toggle. Below the desktop width the
 * same markup becomes a row of links under the top bar (CSS only, so there is one menu, not two).
 */
export function Sidebar({ items }: { items: readonly NavItem[] }) {
  const { settings } = useStudio();
  const [params] = useSearchParams();
  const search = filterSearch(params);
  const name = settings.name ?? PRODUCT_NAME;

  return (
    <aside className="flex items-center gap-2 border-b border-line bg-surface px-2 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-60 lg:flex-col lg:items-stretch lg:gap-0 lg:border-r lg:border-b-0 lg:px-0">
      <div className="hidden h-14 shrink-0 items-center gap-2.5 border-b border-line px-3 lg:flex">
        <LogoTile name={name} imageUrl={settings.logoUrl} />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold text-fg">{name}</span>
          {settings.name && <span className="text-[11px] text-fg-subtle">{PRODUCT_NAME}</span>}
        </div>
      </div>

      <nav
        aria-label="Main"
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2 [scrollbar-width:none] lg:flex-none lg:flex-col lg:overflow-visible lg:p-2 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={{ pathname: item.to, search: item.filters === 'none' ? '' : search }}
            end={item.end}
            className={({ isActive }) =>
              `${LINK_BASE} ${
                isActive
                  ? 'bg-accent text-accent-fg shadow-card'
                  : 'text-fg-muted hover:bg-muted hover:text-fg'
              }`
            }
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 lg:mt-auto lg:border-t lg:border-line lg:p-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
