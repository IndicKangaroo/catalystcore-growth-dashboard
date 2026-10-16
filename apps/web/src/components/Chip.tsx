import type { ReactNode } from 'react';

export type ChipTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

// A tinted fill with a matching border and the "-strong" text colour (see index.css), so the text
// stays readable in both themes. The words carry the meaning; the colour only backs them up.
const TONE_CLASSES: Record<ChipTone, string> = {
  neutral: 'border-line bg-muted text-fg-muted',
  accent: 'border-accent/25 bg-accent/10 text-accent',
  ok: 'border-ok/30 bg-ok/10 text-ok-strong',
  warn: 'border-warn/35 bg-warn/10 text-warn-strong',
  danger: 'border-danger/30 bg-danger/10 text-danger-strong',
};

interface ChipProps {
  tone?: ChipTone;
  /** A small filled circle before the text, for statuses. */
  dot?: boolean;
  /** Monospace text, for identifiers such as a property ID. */
  mono?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** A 22px label for a status or a short fact. */
export function Chip({
  tone = 'neutral',
  dot = false,
  mono = false,
  title,
  className = '',
  children,
}: ChipProps) {
  return (
    <span
      title={title}
      className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-chip border px-2 text-[11px] font-medium ${
        mono ? 'font-mono' : ''
      } ${TONE_CLASSES[tone]} ${className}`}
    >
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
