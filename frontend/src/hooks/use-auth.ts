import { createContext, useContext } from 'react';
import type { UserProfile } from '@/lib/types';

/**
 * Split from `lib/auth-context.tsx` for the same reason `use-department.ts` is split from
 * `department-context.tsx`: a module that exports both a component and a non-component
 * breaks React Fast Refresh, which can only replace a module whose exports are all
 * components.
 */
export interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  /**
   * Set when a valid session was refused entry — no profile, or a deactivated one. The
   * session has already been ended by then; this is the reason to show on the login
   * screen, which would otherwise just bounce the user back with no explanation.
   */
  accessError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAccessError: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
