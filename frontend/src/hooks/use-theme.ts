import { createContext, useContext } from 'react';
import type { ResolvedTheme, ThemePreference } from '@/lib/theme-storage';

export interface ThemeContextValue {
  /** What the user chose, including `system`. */
  preference: ThemePreference;
  /** What is actually on screen, with `system` already resolved. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Flips between light and dark, resolving `system` to its opposite first. */
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
