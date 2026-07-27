/**
 * Theme preference storage and resolution.
 *
 * Mirrors the `department-scope.ts` pattern: pure helpers here, React state in the
 * provider, so the same logic can be exercised without mounting a component.
 *
 * The inline bootstrap script in `index.html` duplicates `readStoredTheme` and
 * `resolveTheme` in plain JS so the correct class is on `<html>` before first paint.
 * If the storage key or the class name changes, change it there too — the constants
 * below are exported so the test suite can assert they stay in step.
 */

/** localStorage key holding the user's theme preference. */
export const THEME_STORAGE_KEY = 'sail_theme';

/** Class applied to `<html>` for the dark palette. Matches `@custom-variant dark` in index.css. */
export const DARK_CLASS = 'dark';

/** What the user chose. `system` follows the operating system setting. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** What is actually rendered. `system` has been resolved away. */
export type ResolvedTheme = 'light' | 'dark';

export const themePreferences: ThemePreference[] = ['light', 'dark', 'system'];

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // Storage can throw in private-browsing modes; fall back to following the OS.
    return 'system';
  }
}

export function writeStoredTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Persistence is best-effort; the choice still applies for this session.
  }
}

/**
 * jsdom does not implement `matchMedia`, and neither do very old browsers, so every
 * caller has to tolerate its absence rather than assume a MediaQueryList exists.
 */
export function prefersDarkQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(prefers-color-scheme: dark)');
}

export function systemTheme(): ResolvedTheme {
  return prefersDarkQuery()?.matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/**
 * Applies the resolved theme to the document.
 *
 * `color-scheme` is set alongside the class so native UI the app does not style —
 * form controls, the scrollbar gutter, autofill — follows the theme too. Without it a
 * dark page renders white scrollbars.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS, resolved === 'dark');
  root.style.colorScheme = resolved;
}
