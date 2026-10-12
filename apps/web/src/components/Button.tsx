import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'border border-line bg-surface text-fg hover:bg-muted',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
