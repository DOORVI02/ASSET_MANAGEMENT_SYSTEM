import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SailLogo } from '@/components/brand/SailLogo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { registeredRoutes } from '@/lib/routes';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const { user, signIn, accessError, clearAccessError } = useAuth();
  const [, setLocation] = useLocation();

  /**
   * Navigation is driven by the session becoming real, not by the submit handler
   * returning. A signed-in identity still has to clear the profile and active-account
   * checks before it counts as access, so redirecting the moment `signIn` resolves would
   * push a refused account to the dashboard and let the shell bounce it straight back.
   */
  useEffect(() => {
    if (user) {
      // Sonner, not the shadcn `useToast` hook: only sonner's <Toaster> is mounted in
      // App.tsx, so anything dispatched through the other system rendered nowhere.
      toast.success('Signed in', { description: `Welcome back, ${user.name}.` });
      setLocation(registeredRoutes.dashboard);
    }
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Field-level problems belong next to the field. A toast is the wrong place for
    // "you left this blank": it is transient, unlabelled, and detached from the input.
    const nextErrors = {
      email: email.trim() ? '' : 'Enter your email address.',
      password: password ? '' : 'Enter your password.',
    };
    setFieldErrors(nextErrors);
    setFormError(null);
    clearAccessError();
    if (nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      // Deliberately no navigation here — see the effect above.
    } catch {
      // Deliberately generic, and deliberately not branching on the error: distinguishing
      // "no such account" from "wrong password" would turn this form into a way to test
      // whether an address is on the roster.
      setFormError('Those credentials were not recognised. Check your email and password.');
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {/* Left Panel - Branding */}
      <aside
        aria-label="SAIL Plant Maintenance overview"
        className="relative hidden overflow-hidden bg-sidebar px-12 py-14 text-white lg:flex lg:flex-col xl:px-16"
      >
        {/* Decorative background element */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,transparent_0%,transparent_42%,hsl(var(--sidebar-primary)/0.08)_100%)]" />

        <div className="relative z-10 flex max-w-xl flex-1 flex-col justify-center">
          <SailLogo size="lg" src="/sail-logo-wt.avif" className="mb-10 items-start" />
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-primary">
            Internal operations platform
          </p>
          {/* Display copy, not the page heading: this panel is `hidden lg:flex`, so an
              <h1> here would leave every screen below `lg` with no level-1 heading. */}
          <p className="max-w-lg text-4xl font-bold tracking-tight xl:text-[2.75rem] xl:leading-[1.1]">
            Plant Maintenance &amp; Asset Register
          </p>
          <p className="mt-5 max-w-md text-lg leading-8 text-sidebar-foreground">
            The central system for tracking industrial machinery, managing maintenance schedules,
            and monitoring plant operations.
          </p>
          <ul className="mt-9 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 border-t border-sidebar-border/80 pt-6 text-sm text-sidebar-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sidebar-primary" aria-hidden="true" />
              Department-scoped access
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sidebar-primary" aria-hidden="true" />
              Maintenance oversight
            </li>
          </ul>
        </div>

        <div className="relative z-10">
          <p className="border-l-2 border-sidebar-primary pl-4 text-sm font-medium text-sidebar-foreground">
            "Precision in operations. Excellence in steel."
          </p>
        </div>
      </aside>

      {/* Right Panel - Form */}
      <main className="relative flex flex-col justify-center bg-background px-5 py-8 sm:px-12 lg:px-16 xl:px-20">
        {/* The auth pages render outside AppShell, so they need their own theme control. */}
        <ThemeToggle variant="button" className="absolute right-4 top-4" />
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <SailLogo size="md" />
          </div>

          <section className="rounded-2xl border border-border/90 bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-6 text-center lg:text-left">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Secure sign in
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Sign in to your account
              </h1>
              <p className="mt-2 text-muted-foreground">
                Enter your credentials to access your workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  {/* No placeholder: the field is already labelled, and any example
                      address here would imply a mail domain the roster doesn't use. */}
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={fieldErrors.email ? true : undefined}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    className="h-10 bg-background"
                  />
                  {fieldErrors.email ? (
                    <p id="email-error" className="text-sm text-destructive">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="password">Password</Label>
                    <a
                      href="/forgot-password"
                      className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      aria-invalid={fieldErrors.password ? true : undefined}
                      aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                      className="h-10 bg-background pr-10"
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
                  {fieldErrors.password ? (
                    <p id="password-error" className="text-sm text-destructive">
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* `accessError` is a different failure from `formError`: the credentials were
                  correct, but the account is not provisioned or has been deactivated. It
                  must say so, because "not recognised" would send someone off to retype a
                  password that was never the problem. */}
              {formError || accessError ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {formError ?? accessError}
                </p>
              ) : null}

              <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <div className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
              <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              You stay signed in on this device until you log out.
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
