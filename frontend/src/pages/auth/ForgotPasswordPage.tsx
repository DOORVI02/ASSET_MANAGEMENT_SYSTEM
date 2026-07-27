import React, { useState } from 'react';
import { SailLogo } from '@/components/brand/SailLogo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';
import { previewResetLink } from '@/lib/password-reset';
import { registeredRoutes } from '@/lib/routes';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setIsSuccess(true);
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
                  placeholder="name@sail.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

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

            {/* No mail is sent during the preview, so the recovery screen would otherwise
                be unreachable for review. Removed when Supabase sends the real email. */}
            <div className="mt-6 rounded-md border border-dashed p-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preview only
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                No email is sent yet. Open the recovery screen directly:
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
                <Link href={previewResetLink('valid')} className="text-primary hover:underline">
                  Valid link
                </Link>
                <Link href={previewResetLink('expired')} className="text-primary hover:underline">
                  Expired link
                </Link>
                <Link
                  href={`${registeredRoutes.resetPassword}?token=broken`}
                  className="text-primary hover:underline"
                >
                  Malformed link
                </Link>
                <Link
                  href={registeredRoutes.resetPassword}
                  className="text-primary hover:underline"
                >
                  Missing token
                </Link>
              </div>
            </div>
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
