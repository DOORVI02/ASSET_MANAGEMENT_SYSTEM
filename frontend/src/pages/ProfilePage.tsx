import { Link } from 'wouter';
import { KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { registeredRoutes } from '@/lib/routes';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Profile"
        description="Your account details. Identity and access are managed from the employee roster."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Info */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold mx-auto mb-4">
              {user.avatarInitials}
            </div>
            <CardTitle className="text-xl">{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Role
              </p>
              <p className="text-sm font-bold uppercase text-primary tracking-wide">{user.role}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Department
              </p>
              <p className="text-sm font-medium">{user.department}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Position
              </p>
              <p className="text-sm font-medium">{user.position}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Status
              </p>
              <StatusBadge status="active" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Last Login
              </p>
              <p className="text-sm font-medium">{new Date(user.lastLogin).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Right column — read-only identity, per the roster-controlled decision. */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal information</CardTitle>
              <CardDescription>
                These details come from the employee roster and are not editable in the application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Full name" value={user.name} />
                <ReadOnlyField label="Email" value={user.email} />
                <ReadOnlyField label="Phone" value={user.phone} />
                <ReadOnlyField label="Position" value={user.position} />
                <ReadOnlyField label="Department" value={user.department} />
                <ReadOnlyField label="Role" value={user.role} />
              </dl>

              <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Role, department, position, phone, and email are set from the employee roster by
                  the project operator. Contact your maintenance office to correct any of them. No
                  screen in this application can change your own role or department.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>
                Passwords are changed through the secure recovery flow, not from this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Requesting a reset sends a single-use link to your registered email address. The
                application never stores or displays your password.
              </p>
              <Separator />
              <div className="flex flex-wrap items-center gap-3">
                <Link href={registeredRoutes.forgotPassword}>
                  <Button variant="outline">
                    <KeyRound size={16} className="mr-2" aria-hidden="true" />
                    Reset password
                  </Button>
                </Link>
                <span className="text-xs text-muted-foreground">
                  Preview: no email is sent until authentication is connected.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** One roster-controlled value. Rendered as text, never as a disabled input. */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  );
}
