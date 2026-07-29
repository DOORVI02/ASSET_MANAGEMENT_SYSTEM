import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import {
  AccessDeniedError,
  loadSignedInProfile,
  signIn as signInWithSupabase,
  signOut as signOutOfSupabase,
} from '@/lib/supabase/auth';
import { AuthContext, type AuthContextValue } from '@/hooks/use-auth';
import { registeredRoutes } from '@/lib/routes';
import type { UserProfile } from '@/lib/types';

/**
 * `undefined` means "the initial session has not been resolved yet", which is distinct from
 * `null` ("resolved: nobody is signed in"). Collapsing the two would flash the login screen
 * on every reload, before Supabase finishes reading the persisted session.
 */
type SessionUserId = string | null | undefined;

/**
 * The answer to "who is this session?", tagged with the session it answers *for*.
 *
 * Tagging is what makes the loading state derivable rather than separately tracked: the
 * profile is resolved exactly when `resolution.sessionId` matches the current session id.
 * A separate `isResolved` flag would have to be flipped back to false at the start of every
 * session change, which is a synchronous setState inside an effect — cascading renders, and
 * one more piece of state that can disagree with the others.
 */
interface Resolution {
  sessionId: string | null;
  user: UserProfile | null;
}

/**
 * True while the browser is on the password-recovery screen.
 *
 * A recovery link signs the user in — that is how Supabase authorizes the password change.
 * But that session must not be run through the profile/active checks: an account with no
 * profile row, or a deactivated one, would be signed straight back out, destroying the
 * recovery session before the new password could be saved. The recovery screen is the one
 * place a session exists purely to change a credential rather than to use the app, so
 * authorization is deliberately not evaluated there.
 *
 * Read from `window.location` rather than the router because this provider sits outside the
 * router in `App.tsx` — it has to, since the router's pages consume it.
 */
function isOnRecoveryRoute(): boolean {
  return window.location.pathname.replace(/\/$/, '').endsWith(registeredRoutes.resetPassword);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUserId, setSessionUserId] = useState<SessionUserId>(undefined);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Subscribes to Supabase's own session state. The callback only records the id — it
  // deliberately performs no queries, because supabase-js invokes it while holding its
  // internal auth lock, and an awaited request from inside can deadlock against the token
  // refresh that triggered the event. The profile load happens in the effect below, off the
  // callback's stack.
  useEffect(() => {
    const client = getSupabaseClient();
    let active = true;

    client.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active) setSessionUserId(session?.user.id ?? null);
      })
      .catch(() => {
        if (active) setSessionUserId(null);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sessionUserId === undefined) return;

    let cancelled = false;

    // Every path runs inside this async function, including the ones that need no await.
    // Resolving the trivial cases synchronously in the effect body would set state during
    // the effect and cascade an extra render pass for no benefit.
    void (async () => {
      if (sessionUserId === null || isOnRecoveryRoute()) {
        if (!cancelled) setResolution({ sessionId: sessionUserId, user: null });
        return;
      }

      try {
        const profile = await loadSignedInProfile();
        if (!cancelled) setResolution({ sessionId: sessionUserId, user: profile });
      } catch (error) {
        if (cancelled) return;

        if (error instanceof AccessDeniedError) {
          setAccessError(error.message);
          setResolution({ sessionId: sessionUserId, user: null });
          // The session is valid but unusable. Ending it is what stops the shell from
          // redirecting to login and straight back again on every render.
          await signOutOfSupabase().catch(() => undefined);
          return;
        }

        // A network or RLS failure is not a signed-out user, and pretending otherwise would
        // silently drop someone out of the app mid-session. Surface it and leave the session
        // alone so a retry can succeed.
        setAccessError(
          error instanceof Error
            ? `Could not load your profile: ${error.message}`
            : 'Could not load your profile.',
        );
        setResolution({ sessionId: sessionUserId, user: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAccessError(null);
    await signInWithSupabase(email, password);
    // No state is set here. `onAuthStateChange` fires for the new session and the effect
    // above loads the profile, so the signed-in path is identical to the reload path rather
    // than a second, subtly different one.
  }, []);

  const signOut = useCallback(async () => {
    setAccessError(null);
    await signOutOfSupabase();
    setSessionUserId(null);
  }, []);

  const clearAccessError = useCallback(() => setAccessError(null), []);

  const value = useMemo<AuthContextValue>(() => {
    const isResolved = sessionUserId !== undefined && resolution?.sessionId === sessionUserId;
    return {
      user: isResolved ? resolution.user : null,
      // Loading spans "session unknown" and "session known but not yet answered for".
      // Without the second half, the shell would see a session with no user and bounce to
      // login for the renders in between.
      isLoading: !isResolved,
      accessError,
      signIn,
      signOut,
      clearAccessError,
    };
  }, [sessionUserId, resolution, accessError, signIn, signOut, clearAccessError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
