import { useState } from 'react';
import { applyTheme, readStoredTheme, storeTheme } from '../lib/theme';
import type { ThemeChoice } from '../lib/theme';
import { Icon } from './Icon';
import type { IconName } from './Icon';

const OPTIONS: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Match system theme', icon: 'monitor' },
  { value: 'light', label: 'Light theme', icon: 'sun' },
  { value: 'dark', label: 'Dark theme', icon: 'moon' },
];

/**
 * Light, dark, or follow the system. The choice is saved in this browser and applied at once; the
 * inline script in index.html applies it again before the next page load is drawn.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readStoredTheme);

  function choose(next: ThemeChoice) {
    setChoice(next);
    storeTheme(next);
    applyTheme(next);
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center rounded-control border border-line bg-muted p-0.5"
    >
      {OPTIONS.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={choice === value}
          onClick={() => choose(value)}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:text-fg aria-pressed:bg-surface aria-pressed:text-fg aria-pressed:shadow-card"
        >
          <Icon name={icon} />
        </button>
      ))}
    </div>
  );
}
