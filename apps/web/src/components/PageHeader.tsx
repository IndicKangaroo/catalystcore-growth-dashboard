import type { ReactNode } from 'react';
import { Chip } from './Chip';

interface PageHeaderProps {
  title: string;
  /** A total shown beside the title, such as the number of apps. */
  count?: number;
  description?: ReactNode;
  /** Buttons for the right-hand side. */
  actions?: ReactNode;
}

/** The title block at the top of a screen: heading, optional count and description, actions. */
export function PageHeader({ title, count, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {count !== undefined && (
            <Chip>
              <span className="sr-only">Total: </span>
              {count}
            </Chip>
          )}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
