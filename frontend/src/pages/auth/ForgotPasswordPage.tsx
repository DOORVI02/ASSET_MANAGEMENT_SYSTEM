import React, { useState } from 'react';
import { SailLogo } from '@/components/brand/SailLogo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';
import { requestPasswordRecovery } from '@/lib/supabase/auth';
import { registeredRoutes } from '@/lib/routes';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await requestPasswordRecovery(email, registeredRoutes.resetPassword);
      // Shown whether or not the address is on the roster — Supabase reports success either
      // way, and branching here would turn this form into a way to test whether someone
      // has an account. The confirmation copy below is worded to match.
      setIsSuccess(true);
    } catch (requestError) {
      // Only genuine transport/rate-limit failures reach here. Those are worth showing:
      // Supabase rate-limits recovery mail per address, and a silent no-op would look
      // identical to a delivered email that never arrives.
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The reset email could not be sent. Try again in a moment.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {/* The auth pages render outside AppShell, so they need their own theme control. */}
      <ThemeToggle variant="button" className="absolute right-4 top-4" />
      <div className="w-full max-w-md bg-card border rounded-lg shadow-sm p-8">
        <div className="flex justify-center mb-6">
          <SailLogo size="md" />
        </div>

        {!isSuccess ? (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
              <p className="text-muted-foreground text-sm mt-2">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h1 className="mb-2 text-xl font-bold text-foreground">Check your email</h1>
            <p className="text-muted-foreground text-sm mb-6">
              If <span className="font-medium text-foreground">{email}</span> is registered, you
              will receive a password reset link shortly.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setIsSuccess(false)}>
              Try another email
            </Button>

          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
