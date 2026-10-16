import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { applyTheme, isThemeChoice, readStoredTheme, storeTheme, THEME_STORAGE_KEY } from './theme';

afterEach(() => {
  // Put the real storage back first: a test may have replaced it with one that refuses everything.
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

/** A storage that refuses everything, the way a browser with blocked site data does. */
const BLOCKED_STORAGE = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('isThemeChoice', () => {
  it('accepts the three choices and nothing else', () => {
    expect(['system', 'light', 'dark'].every(isThemeChoice)).toBe(true);
    expect(isThemeChoice('sepia')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});

describe('the saved theme', () => {
  it('is "system" until a choice has been saved', () => {
    expect(readStoredTheme()).toBe('system');
  });

  it('comes back as saved', () => {
    storeTheme('dark');

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('is forgotten when the person goes back to "system"', () => {
    storeTheme('light');
    storeTheme('system');

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readStoredTheme()).toBe('system');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    expect(readStoredTheme()).toBe('system');
  });

  it('keeps working when the browser blocks storage', () => {
    vi.stubGlobal('localStorage', BLOCKED_STORAGE);

    expect(readStoredTheme()).toBe('system');
    expect(() => storeTheme('dark')).not.toThrow();
  });
});

describe('applyTheme', () => {
  it('puts a chosen theme on the page and removes it for "system"', () => {
    const root = document.documentElement;

    applyTheme('dark');
    expect(root).toHaveAttribute('data-theme', 'dark');

    applyTheme('light');
    expect(root).toHaveAttribute('data-theme', 'light');

    applyTheme('system');
    expect(root).not.toHaveAttribute('data-theme');
  });
});

describe('the script in index.html that applies the theme before the first paint', () => {
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1];

  function runScript() {
    if (!script) throw new Error('index.html has no inline script');
    new Function(script)();
  }

  it('reads the key the app saves under', () => {
    expect(script).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it.each(['light', 'dark'] as const)('applies a saved %s theme', (choice) => {
    localStorage.setItem(THEME_STORAGE_KEY, choice);

    runScript();

    expect(document.documentElement).toHaveAttribute('data-theme', choice);
  });

  it('leaves the system preference alone when nothing valid is saved', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    runScript();

    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('does not break the page when storage is blocked', () => {
    vi.stubGlobal('localStorage', BLOCKED_STORAGE);

    expect(runScript).not.toThrow();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});

describe('the colour tokens in index.css', () => {
  const css = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../index.css'),
    'utf8',
  );

  /** The declarations inside the first block that starts with this selector. */
  function declarations(selector: string): string[] {
    const open = css.indexOf('{', css.indexOf(selector));
    return css
      .slice(open + 1, css.indexOf('}', open))
      .split(';')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const names = (lines: string[]) => lines.map((line) => line.split(':')[0]).sort();

  it('are the same whether dark comes from the system preference or from the toggle', () => {
    expect(declarations(":root:not([data-theme='light'])")).toEqual(
      declarations(":root[data-theme='dark']"),
    );
  });

  it('are defined for both themes, so no token falls back to the other theme', () => {
    const light = names(declarations(':root {'));

    expect(names(declarations(":root[data-theme='dark']"))).toEqual(light);
    expect(light).toContain('--canvas');
    expect(light).toContain('--accent');
  });
});
