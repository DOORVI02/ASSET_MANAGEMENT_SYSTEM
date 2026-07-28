// Applies the stored theme before first paint. Without this the page renders in
// light, then flips to dark once React mounts. Mirrors readStoredTheme/resolveTheme
// in src/lib/theme-storage.ts; the key and class name must stay in step with the
// THEME_STORAGE_KEY and DARK_CLASS constants there (theme-storage.test.ts asserts it).
//
// A same-origin external file, not an inline <script>, specifically so the
// production CSP's `script-src 'self'` (no 'unsafe-inline') covers it without a
// content hash that would silently go stale the next time this file changes.
(function () {
  try {
    var stored = window.localStorage.getItem('sail_theme');
    var preference =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var dark =
      preference === 'dark' ||
      (preference === 'system' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (error) {
    // Storage or matchMedia unavailable: fall through to the light default.
  }
})();
