import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '../lib/theme';
import { ThemeToggle } from './ThemeToggle';

const system = () => screen.getByRole('button', { name: 'Match system theme' });
const light = () => screen.getByRole('button', { name: 'Light theme' });
const dark = () => screen.getByRole('button', { name: 'Dark theme' });

describe('ThemeToggle', () => {
  it('offers the three choices as a group and starts on "match system"', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(system()).toHaveAttribute('aria-pressed', 'true');
    expect(light()).toHaveAttribute('aria-pressed', 'false');
    expect(dark()).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts on the choice saved in this browser', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    render(<ThemeToggle />);

    expect(dark()).toHaveAttribute('aria-pressed', 'true');
    expect(system()).toHaveAttribute('aria-pressed', 'false');
  });

  it('ignores a saved value that is not a theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');

    render(<ThemeToggle />);

    expect(system()).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies a chosen theme at once and saves it', () => {
    render(<ThemeToggle />);

    fireEvent.click(dark());
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(dark()).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(light());
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(dark()).toHaveAttribute('aria-pressed', 'false');
    expect(light()).toHaveAttribute('aria-pressed', 'true');
  });

  it('hands the decision back to the operating system on "match system"', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<ThemeToggle />);

    fireEvent.click(system());

    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(system()).toHaveAttribute('aria-pressed', 'true');
  });
});
