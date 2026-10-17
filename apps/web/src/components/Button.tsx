import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50';

// Controls are 36px high; the small size (32px) is for buttons inside table rows.
const SIZE_CLASSES: Record<Size, string> = {
  md: 'h-9 px-3.5 text-[13px]',
  sm: 'h-8 px-2.5 text-xs',
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-fg hover:bg-muted',
  // Outlined rather than filled, so its text keeps enough contrast in both themes.
  danger: 'border border-danger/40 bg-surface text-danger-strong hover:bg-danger/10',
  ghost: 'text-fg-muted hover:bg-muted hover:text-fg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE_CLASSES} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
