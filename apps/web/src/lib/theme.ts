/**
 * The light/dark choice. "system" follows the operating system; "light" and "dark" come from the
 * theme toggle, are saved in this browser, and are put on <html> as data-theme (see index.css).
 * Storage can be blocked (private windows, strict settings), so every read and write is guarded and
 * the page works without it.
 */

export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** Must match the key in the inline script of index.html, which applies the choice before paint. */
export const THEME_STORAGE_KEY = 'growth.theme';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value);
}

export function readStoredTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not saved: the choice still applies until the page is closed.
  }
}

/** "system" removes the attribute so the operating system's preference decides again. */
export function applyTheme(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
): void {
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}
