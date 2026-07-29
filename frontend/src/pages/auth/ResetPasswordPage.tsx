import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { SailLogo } from '@/components/brand/SailLogo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PASSWORD_MIN_LENGTH,
  classifyRecoveryLink,
  validateNewPassword,
  type RecoveryLinkState,
} from '@/lib/password-reset';
import { getSupabaseClient } from '@/lib/supabase';
import { updatePassword, signOut } from '@/lib/supabase/auth';
import { registeredRoutes } from '@/lib/routes';

/**
 * Guidance per unusable-link state. Every message is deliberately generic about whether an
 * account exists — the same rule the login and forgot-password screens follow.
 */
const unusableLinkCopy: Record<
  Exclude<RecoveryLinkState, 'pending'> | 'failed',
  { title: string; description: string }
> = {
  missing: {
    title: 'No recovery link',
    description:
      'This page is opened from the link in a password recovery email. Request one to continue.',
  },
  invalid: {
    title: 'This link is not usable',
    description:
      'The recovery link could not be read, which usually means it was cut short by an email client. Request a fresh one.',
  },
  expired: {
    title: 'This link is no longer valid',
    description:
      'Recovery links are short-lived and can only be used once, so this one has either expired or already set a password. Request a new one to continue.',
  },
  failed: {
    title: 'This link could not be verified',
    description:
      'The link carried a recovery request, but no session came back from it. Request a new link and open it in the same browser.',
  },
};

/**
 * The screen's own view of the recovery attempt.
 *
 * `checking` exists because a usable link is not usable *immediately*: supabase-js reads the
 * token out of the URL and exchanges it asynchronously on load. Offering the form before
 * that finishes would let someone submit with no session and get an error for a link that
 * was fine.
 */
type ScreenState = Exclude<RecoveryLinkState, 'pending'> | 'checking' | 'ready' | 'failed';

export default function ResetPasswordPage() {
  const [screenState, setScreenState] = useState<ScreenState>(() => {
    const initial = classifyRecoveryLink({
      hash: window.location.hash,
      search: window.location.search,
    });
    return initial === 'pending' ? 'checking' : initial;
  });

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // `missing` is probed too, not just `checking`. supabase-js consumes the recovery
    // fragment and strips it from the URL as soon as the client is constructed, so a
    // slightly different mount order — or a reload after the token was already exchanged —
    // leaves a perfectly good recovery session behind an address bar with no parameters at
    // all. Declaring "no recovery link" from the URL alone would then lock the user out of
    // a session they legitimately hold. An explicit error in the URL is never re-probed:
    // that is Supabase's own verdict, and no session can override it.
    if (screenState !== 'checking' && screenState !== 'missing') return;

    const client = getSupabaseClient();
    let settled = false;

    // Two ways in, because either can win the race on load: the PASSWORD_RECOVERY event, or
    // a session that supabase-js had already established before this component mounted.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        settled = true;
        setScreenState('ready');
      }
    });

    void client.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        settled = true;
        setScreenState('ready');
      }
    });

    // If neither produced a session, the link carried something that didn't work. Reporting
    // that is better than leaving a spinner up forever, which is what an unbounded wait on
    // an event that will never fire would do. A URL with no recovery parameters at all keeps
    // its own "no link" message rather than being relabelled as a failure.
    const timeout = window.setTimeout(() => {
      if (!settled) setScreenState((previous) => (previous === 'missing' ? 'missing' : 'failed'));
    }, 8000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [screenState]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await updatePassword(password);
      // The recovery session is ended deliberately. It was issued to change a credential,
      // not to use the app, and requiring one real sign-in with the new password is the only
      // confirmation available that it was actually stored.
      await signOut().catch(() => undefined);
      setIsDone(true);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'The password could not be updated. Request a new recovery link and try again.',
      );
    } finally {
      setIsSubmitting(false);
      setPassword('');
      setConfirmation('');
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <ThemeToggle variant="button" className="absolute right-4 top-4" />
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <SailLogo size="md" />
        </div>

        {isDone ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 size={24} aria-hidden="true" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-foreground">Password updated</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Your password has been set and this recovery link is now spent. Sign in with the new
              password to continue.
            </p>
            <Link href={registeredRoutes.login}>
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </div>
        ) : screenState === 'checking' ? (
          <div className="py-8 text-center">
            <Loader2
              className="mx-auto mb-4 h-6 w-6 animate-spin text-primary"
              aria-hidden="true"
            />
            <p role="status" className="text-sm text-muted-foreground">
              Verifying your recovery link…
            </p>
          </div>
        ) : screenState !== 'ready' ? (
          <div className="py-4 text-center" role="alert">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <AlertTriangle size={24} aria-hidden="true" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-foreground">
              {unusableLinkCopy[screenState].title}
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {unusableLinkCopy[screenState].description}
            </p>
            <Link href={registeredRoutes.forgotPassword}>
              <Button className="w-full">Request a new link</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose a password of at least {PASSWORD_MIN_LENGTH} characters, with upper and lower
                case letters and a number.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'reset-error' : undefined}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'reset-error' : undefined}
                />
              </div>

              {error ? (
                <p
                  id="reset-error"
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </form>
          </>
        )}

        <div className="mt-8 text-center">
          <Link
            href={registeredRoutes.login}
            className="inline-flex items-center rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
