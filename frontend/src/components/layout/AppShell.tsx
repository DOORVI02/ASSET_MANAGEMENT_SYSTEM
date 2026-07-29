import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useDepartment } from '@/hooks/use-department';
import { Loader2 } from 'lucide-react';
import { registeredRoutes } from '@/lib/routes';

interface AppShellProps {
  children: React.ReactNode;
}

/** Routes reachable without a session. Everything else redirects to login. */
const publicRoutes: string[] = [
  registeredRoutes.login,
  registeredRoutes.forgotPassword,
  registeredRoutes.resetPassword,
];

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user, isLoading: sessionLoading } = useAuth();
  const { current, canChoose, isLoading: departmentsLoading } = useDepartment();
  const [location, setLocation] = useLocation();

  // The shell is not ready until *both* questions are answered: who is signed in, and
  // which departments they may reach. Gating on the session alone would render scoped
  // pages with no department in context for the length of the department fetch.
  const isLoading = sessionLoading || departmentsLoading;

  // Recovery is reached from an email link by a signed-out user, so it has to sit
  // alongside login and forgot-password rather than behind the auth guard.
  const isPublicRoute = publicRoutes.includes(location);

  React.useEffect(() => {
    if (!isLoading && !user && !isPublicRoute) {
      setLocation('/login');
    }
  }, [user, isLoading, isPublicRoute, setLocation]);

  // An Officer with several departments must pick one before any scoped page renders,
  // otherwise a list would have no department to scope to.
  const needsDepartment = Boolean(user) && !isLoading && !current && canChoose;
  React.useEffect(() => {
    if (needsDepartment && location !== registeredRoutes.departments) {
      setLocation(registeredRoutes.departments);
    }
  }, [needsDepartment, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          <p role="status" className="text-sm text-muted-foreground">
            Loading your session…
          </p>
        </div>
      </div>
    );
  }

  // Don't wrap auth pages
  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Without this a keyboard user tabs through eight sidebar links and the whole
          header before reaching the page content, on every single navigation. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 flex-col min-w-0">
        <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus:outline-none sm:p-6 lg:p-8"
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
