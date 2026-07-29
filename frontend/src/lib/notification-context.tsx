import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useDepartment } from '@/hooks/use-department';
import { useQuery } from '@tanstack/react-query';
import { listAllMachinesInScope } from '@/lib/supabase/machines';
import { listAllMaintenanceInScope } from '@/lib/supabase/maintenance';
import { listAllRepairsInScope } from '@/lib/supabase/repairs';
import { queryKeys } from '@/lib/supabase/query-keys';
import {
  NotificationContext,
  type NotificationContextValue,
  type NotificationItem,
} from '@/hooks/use-notifications';
import { deriveNotifications } from '@/lib/notifications';
import { readSeenMap, writeSeenIds, type SeenByDepartment } from '@/lib/notification-storage';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { current, scope } = useDepartment();

  // The whole map is held, not just the selected department's slice, so switching
  // department does not lose the read state of the one being left.
  const [seenMap, setSeenMap] = useState<SeenByDepartment>(readSeenMap);

  const departmentId = current?.id ?? null;

  // Derived from the same department-scoped reads the pages use, so a notification can
  // never point at a record the user is not allowed to open. Machines are included
  // because the dashboard KPIs count due dates from machines, not only from records —
  // without them the bell disagreed with the dashboard.
  const enabled = Boolean(departmentId) && scope.departmentIds.length > 0;

  const { data: machines = [] } = useQuery({
    queryKey: [...queryKeys.machines.inScope(scope.departmentIds), departmentId ?? ''],
    queryFn: () => listAllMachinesInScope(scope, departmentId ?? undefined),
    enabled,
  });
  const { data: maintenance = [] } = useQuery({
    queryKey: [...queryKeys.maintenance.all(departmentId ?? ''), 'notifications'],
    queryFn: () => listAllMaintenanceInScope(scope, departmentId ?? undefined),
    enabled,
  });
  const { data: repairs = [] } = useQuery({
    queryKey: [...queryKeys.repairs.all(departmentId ?? ''), 'notifications'],
    queryFn: () => listAllRepairsInScope(scope, departmentId ?? undefined),
    enabled,
  });

  // These share cache keys with the pages themselves, so the bell and the screen a
  // notification links to are reading the same rows — the disagreement this was written to
  // avoid cannot come back through a second, separately-fetched copy.
  const derived = useMemo(
    () => (current ? deriveNotifications(machines, maintenance, repairs) : []),
    [current, machines, maintenance, repairs],
  );

  const seenSet = useMemo(
    () => new Set(departmentId ? (seenMap[departmentId] ?? []) : []),
    [seenMap, departmentId],
  );

  const items = useMemo<NotificationItem[]>(
    () =>
      derived.map((notification) => ({ ...notification, isRead: seenSet.has(notification.id) })),
    [derived, seenSet],
  );

  const unreadCount = items.reduce((count, item) => count + (item.isRead ? 0 : 1), 0);

  /**
   * Persisting happens *before* `setState`, deliberately.
   *
   * React may defer, replay, or discard a state updater, and clicking a notification
   * navigates away — which unmounted this provider before the updater ran and silently
   * dropped the read state. Writing first, then storing the returned value, keeps the
   * two in step whatever React does with the render.
   */
  const persist = useCallback(
    (nextSeen: string[]) => {
      if (!departmentId) return;
      const pruned = writeSeenIds(
        departmentId,
        nextSeen,
        derived.map((notification) => notification.id),
      );
      setSeenMap((previous) => ({ ...previous, [departmentId]: pruned }));
    },
    [departmentId, derived],
  );

  const markRead = useCallback(
    (id: string) => {
      persist([...seenSet, id]);
    },
    [persist, seenSet],
  );

  const markAllRead = useCallback(() => {
    persist(derived.map((notification) => notification.id));
  }, [persist, derived]);

  const value = useMemo<NotificationContextValue>(
    () => ({ items, unreadCount, markRead, markAllRead }),
    [items, unreadCount, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
