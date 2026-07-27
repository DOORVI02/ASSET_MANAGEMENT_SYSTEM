import { Link } from 'wouter';
import { BellOff, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { useDepartment } from '@/hooks/use-department';
import { useNotifications } from '@/hooks/use-notifications';
import { reportsPath } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { NotificationTone } from '@/lib/notifications';

const toneDot: Record<NotificationTone, string> = {
  overdue: 'bg-destructive',
  repair: 'bg-amber-500',
  due_soon: 'bg-blue-500',
};

export default function NotificationsPage() {
  const { current } = useDepartment();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();

  if (!current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notifications" description="No department is selected." />
        <EmptyState
          title="Select a department first"
          description="Notifications are scoped to one department. Choose one to continue."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${current.code} · ${current.name}. Derived from open repairs and maintenance that is due or overdue.`}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck size={16} className="mr-2" aria-hidden="true" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <p className="text-sm text-muted-foreground" role="status">
        {items.length === 0
          ? 'No notifications.'
          : `${unreadCount} unread of ${items.length} notification${items.length === 1 ? '' : 's'}.`}
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Nothing needs attention"
          description={`No maintenance is due or overdue and no repair is open in ${current.name}.`}
          action={
            <Link href={reportsPath({ report: 'due-overdue' })}>
              <Button variant="outline">Open the due and overdue report</Button>
            </Link>
          }
        />
      ) : (
        <ul aria-label="Notifications" className="space-y-3">
          {items.map((notification) => (
            <li key={notification.id}>
              <Link
                href={notification.href}
                onClick={() => markRead(notification.id)}
                className={cn(
                  'flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors',
                  'hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !notification.isRead && 'border-primary/40 bg-primary/5',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDot[notification.tone])}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{notification.title}</span>
                    {!notification.isRead ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        New
                      </span>
                    ) : null}
                    <span className="sr-only">{notification.isRead ? '(read)' : '(unread)'}</span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {notification.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
