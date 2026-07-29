import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDepartment } from '@/hooks/use-department';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { registeredRoutes } from '@/lib/routes';
import { Menu, Bell, User, LogOut, Building2, Repeat, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { current, canChoose } = useDepartment();
  const { items: notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [location, setLocation] = useLocation();

  // Deliberately does not clear the current department: clearing here combined with
  // AppShell's "must pick a department" guard left the Officer stuck on the selection
  // page with no way back. Keeping `current` set lets the selection page offer a Back
  // to dashboard action, and picking a new department still overwrites it normally.
  const changeDepartment = () => {
    setLocation(registeredRoutes.departments);
  };

  // Simple breadcrumb generator
  const paths = location.split('/').filter((p) => p);
  const breadcrumbs = paths.map((path, i) => {
    const href = '/' + paths.slice(0, i + 1).join('/');
    const label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
    return { href, label };
  });

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Menu size={20} />
        </button>

        <nav
          aria-label="Breadcrumb"
          className="hidden items-center gap-2 text-sm font-medium text-muted-foreground sm:flex"
        >
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={bc.href}>
              {i > 0 && (
                <span aria-hidden="true" className="text-border">
                  /
                </span>
              )}
              {i === breadcrumbs.length - 1 ? (
                <span aria-current="page" className="text-foreground">
                  {bc.label}
                </span>
              ) : (
                <Link
                  href={bc.href}
                  className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {bc.label}
                </Link>
              )}
            </React.Fragment>
          ))}
          {breadcrumbs.length === 0 && (
            <span aria-current="page" className="text-foreground">
              Dashboard
            </span>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {current ? (
          <div className="flex items-center gap-2 rounded-full border bg-muted/50 py-1 pl-2.5 pr-1.5">
            <Building2 size={14} className="shrink-0 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">
              <span className="sr-only">Current department: </span>
              {current.code}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">{current.name}</span>
            {canChoose ? (
              <button
                type="button"
                onClick={changeDepartment}
                className="ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Repeat size={12} aria-hidden="true" />
                <span className="hidden sm:inline">Change</span>
                <span className="sr-only">Change department</span>
              </button>
            ) : null}
          </div>
        ) : null}

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={
                unreadCount > 0
                  ? `Notifications: ${unreadCount} unread of ${notifications.length}`
                  : 'Notifications: none unread'
              }
              className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell size={20} aria-hidden="true" />
              {/* Driven by the unread count, not the total. It used to be permanently
                  lit, which trains users to ignore it. */}
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-card">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96">
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              <span>
                Notifications
                {current ? (
                  <span className="ml-1 font-normal text-muted-foreground">· {current.code}</span>
                ) : null}
              </span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    // Keeps the menu open so the list visibly changes state.
                    event.preventDefault();
                    markAllRead();
                  }}
                  className="rounded-sm px-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Mark all read
                </button>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nothing needs attention in this department.
              </p>
            ) : (
              <div className="custom-scrollbar max-h-80 overflow-y-auto overscroll-contain">
                {notifications.map((notification) => (
                  <DropdownMenuItem key={notification.id} asChild className="cursor-pointer">
                    <Link
                      href={notification.href}
                      onClick={() => markRead(notification.id)}
                      className={cn(
                        'flex flex-col items-start gap-0.5 p-3',
                        !notification.isRead && 'bg-primary/5',
                      )}
                    >
                      <span className="flex w-full items-center gap-2 text-sm font-semibold">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            notification.tone === 'overdue' && 'bg-destructive',
                            notification.tone === 'repair' && 'bg-amber-500',
                            notification.tone === 'due_soon' && 'bg-blue-500',
                          )}
                        />
                        <span className={cn(!notification.isRead && 'text-foreground')}>
                          {notification.title}
                        </span>
                        {!notification.isRead ? (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-primary">
                            New
                          </span>
                        ) : null}
                        <span className="sr-only">
                          {notification.isRead ? '(read)' : '(unread)'}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {notification.description}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer justify-center">
              <Link
                href={registeredRoutes.notifications}
                className="block w-full py-2 text-center text-sm font-medium text-primary"
              >
                View all notifications
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Avatar and name link straight to the profile page; the caret opens account actions. */}
        <div className="flex items-center rounded-full border border-transparent transition-colors hover:border-border">
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {user?.avatarInitials}
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.name}</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-full p-1.5 pr-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account actions"
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.phone}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.position}</p>
                  <p className="text-[10px] uppercase font-bold text-primary tracking-wider mt-2">
                    {user?.role} · {current?.code ?? 'No department'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/profile">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                onClick={() => void signOut()}
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
