import { useState } from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { useAuth } from '@/lib/mock-auth';
import { cn } from '@/lib/utils';
import { Role } from '@/lib/types';

const previewRoles: readonly { label: string; role: Role }[] = [
  { label: 'Officer', role: 'officer' },
  { label: 'Supervisor', role: 'supervisor' },
];

/**
 * Development-only role switcher. **Never authorization** — it exists to check that the
 * UI reacts correctly to a role, and it is deleted when real accounts arrive in Phase 10.
 *
 * Collapsed by default. Expanded, the panel is roughly 280 px tall and sits over the
 * bottom-right of the page, which on a phone permanently covered a card and any action
 * inside it.
 */
export function RoleDemo() {
  const { user, switchRole } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)]">
      {open ? (
        <div className="flex w-64 flex-col gap-2 rounded-lg border-2 border-amber-400 bg-card p-3 shadow-xl shadow-amber-500/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider text-amber-600 dark:text-amber-400">
              DEMO
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-expanded={true}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown size={16} aria-hidden="true" />
              <span className="sr-only">Hide the role preview panel</span>
            </button>
          </div>
          <div className="flex gap-2">
            {previewRoles.map(({ label, role }) => (
              <button
                key={role}
                onClick={() => switchRole(role)}
                aria-pressed={user.role === role}
                className={cn(
                  'rounded px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  user.role === role
                    ? 'border border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            UI preview only. Production permissions will be enforced by Supabase RLS.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="flex items-center gap-1.5 rounded-full border-2 border-amber-400 bg-card px-3 py-1.5 text-xs font-bold tracking-wider text-amber-600 shadow-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
        >
          <FlaskConical size={14} aria-hidden="true" />
          DEMO
          <span className="sr-only">: open the role preview panel. Current role {user.role}.</span>
        </button>
      )}
    </div>
  );
}
