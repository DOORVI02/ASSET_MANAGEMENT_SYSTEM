import React, { useState } from 'react';
import { useAuth } from '@/lib/mock-auth';
import type { Role } from '@/lib/types';
import { SailLogo } from '@/components/brand/SailLogo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Loader2, Info } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

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
    if (nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);

    if (success) {
      // Sonner, not the shadcn `useToast` hook: only sonner's <Toaster> is mounted in
      // App.tsx, so anything dispatched through the other system rendered nowhere.
      toast.success('Signed in', { description: 'Welcome to SAIL Plant Maintenance.' });
      setLocation('/dashboard');
    } else {
      // Deliberately generic: it must not reveal whether the account exists.
      setFormError(
        'Those credentials were not recognised. Use a listed demo account while preview mode is active.',
      );
    }
  };

  const fillDemo = (role: Role) => {
    setEmail(`${role}@sail.in`);
    setPassword('Demo@1234');
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col bg-sidebar text-white p-12 justify-between relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-sidebar-primary/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <SailLogo size="lg" className="mb-8 items-start" />
          {/* Display copy, not the page heading: this panel is `hidden lg:flex`, so an
              <h1> here would leave every screen below `lg` with no level-1 heading. */}
          <p className="mb-4 max-w-md text-4xl font-bold tracking-tight">
            Plant Maintenance &amp; Asset Register
          </p>
          <p className="text-sidebar-foreground text-lg max-w-md">
            The central system for tracking industrial machinery, managing maintenance schedules,
            and monitoring plant operations.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-sidebar-foreground text-sm font-medium border-l-2 border-sidebar-primary pl-4">
            "Precision in operations. Excellence in steel."
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="relative flex flex-col justify-center bg-background p-8 sm:p-12 lg:p-16">
        {/* The auth pages render outside AppShell, so they need their own theme control. */}
        <ThemeToggle variant="button" className="absolute right-4 top-4" />
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <SailLogo size="md" />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold text-foreground">Sign in to your account</h1>
            <p className="text-muted-foreground mt-2">
              Enter your credentials to access the system
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@sail.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  className="bg-card"
                />
                {fieldErrors.email ? (
                  <p id="email-error" className="text-sm text-destructive">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={fieldErrors.password ? true : undefined}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    className="pr-10 bg-card"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p id="password-error" className="text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {formError}
              </p>
            ) : null}

            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
              >
                Remember me for 30 days
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Demo Credentials Box */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                  Demo Credentials
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 mb-3">
                  This prototype uses mock @sail.in addresses. The final production system will use
                  Supabase Auth.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fillDemo('officer')}
                    className="w-full text-left text-xs bg-card border border-blue-200 dark:border-blue-800 p-2 rounded hover:border-blue-400 transition-colors flex justify-between items-center group"
                  >
                    <div>
                      <span className="font-semibold block">Officer Role</span>
                      <span className="text-muted-foreground">officer@sail.in / Demo@1234</span>
                    </div>
                    <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      Use
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo('supervisor')}
                    className="w-full text-left text-xs bg-card border border-blue-200 dark:border-blue-800 p-2 rounded hover:border-blue-400 transition-colors flex justify-between items-center group"
                  >
                    <div>
                      <span className="font-semibold block">Supervisor Role</span>
                      <span className="text-muted-foreground">supervisor@sail.in / Demo@1234</span>
                    </div>
                    <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      Use
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
