import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeContextValue } from '@/hooks/use-theme';
import {
  applyTheme,
  prefersDarkQuery,
  readStoredTheme,
  systemTheme,
  writeStoredTheme,
  type ThemePreference,
} from '@/lib/theme-storage';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredTheme);
  // Seeded from the OS rather than defaulting to light, so the first paint under a
  // `system` preference already matches the bootstrap script in index.html.
  const [system, setSystem] = useState(systemTheme);

  const resolved = preference === 'system' ? system : preference;

  // The bootstrap script sets the class before React mounts, so this is a
  // reconciliation rather than the initial application.
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Only relevant while the preference is `system`, but the listener is cheap and
  // unconditional attachment keeps the hook order stable.
  useEffect(() => {
    const query = prefersDarkQuery();
    if (!query) return;

    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    writeStoredTheme(next);
    setPreferenceState(next);
  }, []);

  // Resolving `system` before flipping means the first click always visibly changes
  // the theme, instead of switching to an explicit preference that looks identical.
  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
