import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

// Form controls are 36px high with 10px corners. Their border is darker than a card's, because a
// field's edge has to be visible against the page for people to see where to click (3:1 contrast).
const FIELD_BASE =
  'w-full rounded-control border border-line-strong bg-surface text-fg placeholder:text-fg-subtle ' +
  'focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-[invalid=true]:border-danger';

export const FIELD_CLASS = `${FIELD_BASE} h-9 px-3 text-sm`;

/** For a select inside a table row, where a 36px control would make the row taller. */
export const COMPACT_FIELD_CLASS = `${FIELD_BASE} h-8 px-2 text-xs`;

interface FieldFrameProps {
  id: string;
  label: string;
  hint?: string;
  /** Why the value is not acceptable. It replaces the hint. */
  error?: string;
  /** Adds "(required)" after the label, in words, not only a symbol. */
  showRequired?: boolean;
  className?: string;
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  showRequired = false,
  className = '',
  children,
}: FieldFrameProps & { children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-fg">
        {label}
        {showRequired && <span className="font-normal text-fg-subtle"> (required)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}

// The frame owns `id` and `className`, so the element's own props leave them out.
type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>;
type TextFieldProps = FieldFrameProps & InputProps;

/** A labelled text box. `hint` explains the format; `error` marks the value as not acceptable. */
export function TextField({
  id,
  label,
  hint,
  error,
  showRequired,
  className,
  ...input
}: TextFieldProps) {
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      showRequired={showRequired}
      className={className}
    >
      <input
        id={id}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={FIELD_CLASS}
        {...input}
      />
    </FieldFrame>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'>;
type SelectFieldProps = FieldFrameProps & SelectProps;

/** A labelled drop-down. Pass the <option> elements as children. */
export function SelectField({
  id,
  label,
  hint,
  error,
  showRequired,
  className,
  children,
  ...select
}: SelectFieldProps) {
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      showRequired={showRequired}
      className={className}
    >
      <select
        id={id}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={FIELD_CLASS}
        {...select}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
