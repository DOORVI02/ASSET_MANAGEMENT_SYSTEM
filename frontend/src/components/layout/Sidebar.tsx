import React from 'react';
import { useLocation, Link } from 'wouter';
import { cn } from '@/lib/utils';
import { SailLogo } from '../brand/SailLogo';
import { useAuth } from '@/lib/mock-auth';
import {
  LayoutDashboard,
  Settings2,
  Wrench,
  WrenchIcon,
  AlertTriangle,
  BarChart3,
  Bell,
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navGroups = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
  },
  {
    label: 'Assets',
    items: [
      { label: 'Machine Register', icon: Settings2, href: '/machines' },
      { label: 'Installed Parts', icon: Wrench, href: '/parts' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Maintenance', icon: WrenchIcon, href: '/maintenance' },
      { label: 'Repairs', icon: AlertTriangle, href: '/repairs' },
    ],
  },
  {
    label: 'Analytics',
    items: [{ label: 'Reports Center', icon: BarChart3, href: '/reports' }],
  },
  {
    label: 'Account',
    items: [
      { label: 'Notifications', icon: Bell, href: '/notifications' },
      { label: 'Profile', icon: UserCircle, href: '/profile' },
    ],
  },
];

// ── Shared nav body ────────────────────────────────────────────────────────────
function NavContent({
  collapsed,
  onLinkClick,
  navLabel,
}: {
  collapsed: boolean;
  onLinkClick?: () => void;
  /**
   * Distinct per instance. The desktop sidebar and the mobile drawer are both mounted
   * at all times, so a shared name would expose two navigation landmarks called
   * "Primary" and give a screen-reader user no way to tell them apart.
   */
  navLabel: string;
}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        <div
          className={cn(
            'flex items-center gap-3 overflow-hidden',
            collapsed && 'justify-center px-0',
          )}
        >
          <SailLogo
            size="sm"
            src="/sail-logo-wt.avif"
            className={cn('shrink-0', collapsed ? 'w-8 h-8' : 'w-10 h-10')}
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm tracking-wide leading-tight">SAIL</span>
              <span className="text-sidebar-foreground text-[10px] uppercase tracking-wider">
                Plant Maintenance
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav
        aria-label={navLabel}
        className="custom-scrollbar custom-scrollbar-dark flex-1 overflow-y-auto overscroll-contain py-4"
      >
        {navGroups.map((group, i) => (
          <div key={i} className="mb-6">
            {collapsed ? (
              // Collapsed rail still needs the grouping to be announced, and a hairline
              // keeps the icon clusters visually separated without a text label.
              <div
                role="separator"
                aria-label={group.label}
                className="mx-3 mb-2 border-t border-sidebar-border/60"
              />
            ) : (
              <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </h3>
            )}
            <ul className="space-y-1 px-2">
              {group.items.map((item) => {
                const isActive = location === item.href || location.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onLinkClick}
                      aria-current={isActive ? 'page' : undefined}
                      // The label is invisible when collapsed, so it has to survive as an
                      // accessible name and a hover tooltip or the rail is unreadable.
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                        collapsed ? 'justify-center px-2' : 'px-3',
                        isActive
                          ? 'bg-sidebar-primary/15 text-white'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
                      )}
                    >
                      {/* Indicator rail: reads as "you are here" even in the collapsed
                          state, where a filled pill would crowd the 64px column. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <item.icon
                        size={18}
                        aria-hidden="true"
                        className={cn(
                          'shrink-0 transition-colors',
                          isActive
                            ? 'text-sidebar-primary'
                            : 'text-sidebar-foreground/70 group-hover:text-white',
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-sidebar-border shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/profile"
              onClick={onLinkClick}
              className="-m-1 flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-md p-1 transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
                {user?.avatarInitials}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-white truncate">{user?.name}</span>
                <span className="text-[10px] text-sidebar-foreground uppercase tracking-wider truncate">
                  {user?.role}
                </span>
              </div>
            </Link>
            <button
              onClick={logout}
              className="shrink-0 rounded-md p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="flex w-full justify-center rounded-md p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        aria-label="Primary sidebar"
        className={cn(
          'relative hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 md:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <NavContent collapsed={collapsed} navLabel="Primary" />
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-20 z-10 rounded-full border border-sidebar-border bg-sidebar p-1 text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronLeft size={16} aria-hidden="true" />
          )}
        </button>
      </aside>

      {/* ── Mobile drawer ── */}
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onMobileClose}
      />
      {/* Drawer panel */}
      <aside
        aria-label="Mobile sidebar"
        // The panel stays mounted so it can animate, which previously left every nav
        // link in the tab order while the drawer was off-screen. `inert` removes the
        // whole subtree from focus and the accessibility tree when it is closed.
        inert={!mobileOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-xl transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <NavContent collapsed={false} onLinkClick={onMobileClose} navLabel="Primary (mobile)" />
      </aside>
    </>
  );
}
