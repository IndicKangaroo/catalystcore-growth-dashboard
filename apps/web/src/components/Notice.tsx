import type { ReactNode } from 'react';
import { Icon } from './Icon';

type NoticeTone = 'info' | 'warn' | 'danger';

const TONE_CLASSES: Record<NoticeTone, string> = {
  info: 'border-line bg-muted text-fg-muted',
  warn: 'border-warn/35 bg-warn/10 text-warn-strong',
  danger: 'border-danger/30 bg-danger/10 text-danger-strong',
};

/**
 * A boxed message: something the person should know ("info", "warn") or something that went wrong
 * ("danger", announced to screen readers as an alert). It always has an icon and words, so the
 * colour is never the only signal.
 */
export function Notice({
  tone = 'info',
  className = '',
  children,
}: {
  tone?: NoticeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={`flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-sm ${TONE_CLASSES[tone]} ${className}`}
    >
      <Icon name={tone === 'info' ? 'info' : 'alert'} className="mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
