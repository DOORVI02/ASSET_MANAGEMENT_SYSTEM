import React, { useMemo, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { SailLogo } from '@/components/brand/SailLogo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PASSWORD_MIN_LENGTH,
  classifyResetToken,
  consumeResetToken,
  parseResetToken,
  validateNewPassword,
  type ResetTokenState,
} from '@/lib/password-reset';
import { registeredRoutes } from '@/lib/routes';

/**
 * Guidance per invalid-token state. Every message is deliberately generic about whether
 * an account exists — the same rule the login and forgot-password screens follow.
 */
const invalidTokenCopy: Record<
  Exclude<ResetTokenState, 'valid'>,
  { title: string; description: string }
> = {
  missing: {
    title: 'No recovery link',
    description:
      'This page is opened from the link in a password recovery email. Request one to continue.',
  },
  malformed: {
    title: 'This link is not readable',
    description:
      'The recovery link looks incomplete, which usually means it was cut short by an email client. Request a fresh one.',
  },
  expired: {
    title: 'This link has expired',
    description: 'Recovery links are short-lived for security. Request a new one to continue.',
  },
  used: {
    title: 'This link has already been used',
    description:
      'A password was already set with this link. Sign in with the new password, or request another link.',
  },
};

export default function ResetPasswordPage() {
  const searchString = useSearch();
  const token = useMemo(() => new URLSearchParams(searchString).get('token'), [searchString]);

  // Classified once per render rather than stored, so an expiry that lapses while the
  // page is open is caught on submit as well as on load.
  const state = classifyResetToken(token);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Re-checked at submit time: the link may have expired while the form was open.
    const currentState = classifyResetToken(token);
    if (currentState !== 'valid') {
      setError('This recovery link is no longer valid. Request a new one.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const parsed = parseResetToken(token);
    if (parsed) consumeResetToken(parsed.nonce);

    setIsSubmitting(false);
    setIsDone(true);
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
              Your password has been set. Sign in with it to continue. Other sessions will be signed
              out once this is connected to real authentication.
            </p>
            <Link href={registeredRoutes.login}>
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </div>
        ) : state !== 'valid' ? (
          <div className="py-4 text-center" role="alert">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <AlertTriangle size={24} aria-hidden="true" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-foreground">
              {invalidTokenCopy[state].title}
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {invalidTokenCopy[state].description}
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
