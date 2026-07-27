import { Link } from 'wouter';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { registeredRoutes } from '@/lib/routes';

/**
 * Rendered inside `AppShell`, which already supplies the page padding and the scroll
 * container. It previously used `min-h-screen`, which stacked a second full viewport
 * inside the shell's `<main>` and left a large dead scroll region below the message.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass size={32} aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Error 404
        </p>
        <h1 className="mb-2 mt-1 text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mb-8 text-muted-foreground">
          This address does not match any page in the application. It may have been mistyped, or the
          record may have been archived.
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
