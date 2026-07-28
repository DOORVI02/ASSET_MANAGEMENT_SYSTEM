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
  // public/theme-init.js duplicates readStoredTheme/resolveTheme in plain JS so the
  // right theme is applied before first paint — it cannot import these constants, so
  // this test is what stops the two copies drifting apart. It's a same-origin external
  // file rather than an inline <script> specifically so the production CSP's
  // `script-src 'self'` (no 'unsafe-inline') covers it without a content hash that
  // would go stale the next time this file changes (verified against the real CSP via
  // `csp-check.mjs` against the production build, not just here).
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
  const themeInit = readFileSync(resolve(__dirname, '../../public/theme-init.js'), 'utf8');

  it('index.html actually loads the theme bootstrap script', () => {
    expect(html).toContain('<script src="/theme-init.js"></script>');
  });

  it('reads the same storage key the app writes', () => {
    expect(THEME_STORAGE_KEY).toBe('sail_theme');
    expect(themeInit).toContain(`getItem('${THEME_STORAGE_KEY}')`);
  });

  it('toggles the same class the dark variant is keyed on', () => {
    expect(DARK_CLASS).toBe('dark');
    expect(themeInit).toContain(`classList.toggle('${DARK_CLASS}', dark)`);
  });

  it('honours the system preference as well as an explicit one', () => {
    expect(themeInit).toContain('(prefers-color-scheme: dark)');
  });
});
