import { Link } from 'wouter';
import { ShieldAlert, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { registeredRoutes } from '@/lib/routes';

/**
 * Rendered inside `AppShell`; see the note in `NotFoundPage` about `min-h-screen`.
 *
 * The copy deliberately does not say "contact your administrator": the product has no
 * Admin role, Admin account, or Admin dashboard (plan.md section 11). Access changes
 * are an out-of-band roster operation.
 */
export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
          <ShieldAlert size={40} className="text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Access restricted</h1>
        <p className="mb-8 text-muted-foreground">
          Your role does not grant access to this page, or the record belongs to a department
          outside your scope. Access is set from the employee roster — ask your maintenance office
          if you believe this is wrong.
        </p>
        <Link href={registeredRoutes.dashboard}>
          <Button>
            <Home size={16} className="mr-2" aria-hidden="true" />
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
