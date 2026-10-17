import type { HTMLAttributes } from 'react';

/** The white (or dark slate) panel every block of content sits in: 12px corners, a 1px border. */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-line bg-surface shadow-card ${className}`}
      {...rest}
    />
  );
}
