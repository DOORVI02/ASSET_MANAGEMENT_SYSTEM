import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DARK_CLASS,
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from './theme-storage';

describe('theme storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);
    document.documentElement.style.colorScheme = '';
  });

  it('falls back to following the system when nothing is stored', () => {
    expect(readStoredTheme()).toBe('system');
  });

  it('round-trips each explicit preference', () => {
    writeStoredTheme('dark');
    expect(readStoredTheme()).toBe('dark');

    writeStoredTheme('light');
    expect(readStoredTheme()).toBe('light');

    writeStoredTheme('system');
    expect(readStoredTheme()).toBe('system');
  });

  it('ignores a corrupted stored value rather than trusting it', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    expect(readStoredTheme()).toBe('system');
  });

  it('resolves explicit preferences without consulting the system', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('resolves `system` against matchMedia, which the setup stubs to light', () => {
    expect(resolveTheme('system')).toBe('light');
  });

  it('applies and removes the dark class and keeps color-scheme in step', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

describe('index.html theme bootstrap', () => {
  // The inline script duplicates readStoredTheme/resolveTheme in plain JS so the right
  // theme is applied before first paint. It cannot import these constants, so this test
  // is what stops the two copies drifting apart.
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

  it('reads the same storage key the app writes', () => {
    expect(THEME_STORAGE_KEY).toBe('sail_theme');
    expect(html).toContain(`getItem('${THEME_STORAGE_KEY}')`);
  });

  it('toggles the same class the dark variant is keyed on', () => {
    expect(DARK_CLASS).toBe('dark');
    expect(html).toContain(`classList.toggle('${DARK_CLASS}', dark)`);
  });

  it('honours the system preference as well as an explicit one', () => {
    expect(html).toContain('(prefers-color-scheme: dark)');
  });
});
