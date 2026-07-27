import { maintenanceDueState } from './maintenance-record';
import { isDueSoon, isOverdue } from './maintenance-window';
import { isOpenRepair } from './repair-record';
import { machineDetailPath, maintenanceDetailPath, repairDetailPath } from './routes';
import { formatDate } from './utils';
import type { Machine, MaintenanceRecord, RepairRecord } from './types';

export type NotificationTone = 'overdue' | 'due_soon' | 'repair';

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  description: string;
  /** Where clicking the notification goes. Always a registered route. */
  href: string;
  /** ISO date the notification is anchored to, used for ordering. */
  date: string;
}

/** Newest-relevant first within a tone; overdue outranks everything else. */
const toneRank: Record<NotificationTone, number> = { overdue: 0, repair: 1, due_soon: 2 };

/**
 * Derives the notification list from records already scoped to the current department.
 *
 * Nothing is stored: a notification exists exactly as long as the condition that
 * produced it. That is deliberate — the previous header rendered three hard-coded
 * items, one of which ("Low Stock Alert") described stock inventory that was removed
 * from product scope on 2026-07-25, so the menu was advertising a feature that does
 * not exist.
 *
 * Read/unread state is a real feature that needs somewhere to persist, so it belongs
 * with the backend phase rather than here.
 */
export function deriveNotifications(
  machines: Machine[],
  maintenance: MaintenanceRecord[],
  repairs: RepairRecord[],
  limit = 8,
): AppNotification[] {
  const notifications: AppNotification[] = [];

  // Machines carry the schedule the dashboard KPIs count, via `nextMaintenanceDate`.
  // Leaving them out made the bell disagree with the dashboard: a department could show
  // "Due soon 1" while the notification centre said nothing needed attention. Machines
  // already covered by an open maintenance record are skipped below so a single job does
  // not raise two notifications.
  const machinesWithOpenWork = new Set(
    maintenance
      .filter((record) => maintenanceDueState(record) !== 'not_applicable')
      .map((r) => r.machineId),
  );

  for (const machine of machines) {
    if (machine.status === 'retired' || machinesWithOpenWork.has(machine.id)) continue;

    const overdue = isOverdue(machine.nextMaintenanceDate);
    const dueSoon = !overdue && isDueSoon(machine.nextMaintenanceDate);
    if (!overdue && !dueSoon) continue;

    notifications.push({
      id: `machine-${machine.id}:${overdue ? 'overdue' : 'due_soon'}`,
      tone: overdue ? 'overdue' : 'due_soon',
      title: overdue ? 'Maintenance overdue' : 'Maintenance due soon',
      description: `${machine.code} — ${machine.name} is scheduled for ${formatDate(machine.nextMaintenanceDate)}.`,
      href: machineDetailPath(machine.id),
      date: machine.nextMaintenanceDate,
    });
  }

  for (const record of maintenance) {
    const due = maintenanceDueState(record);
    if (due !== 'overdue' && due !== 'due_soon') continue;

    notifications.push({
      // The tone is part of the id so a record escalating from due-soon to overdue
      // becomes a new notification instead of inheriting the earlier one's read state.
      id: `maintenance-${record.id}:${due}`,
      tone: due === 'overdue' ? 'overdue' : 'due_soon',
      title: due === 'overdue' ? 'Overdue maintenance' : 'Maintenance due soon',
      description: `${record.machineCode} — ${record.type} scheduled for ${formatDate(record.scheduledDate)}.`,
      href: maintenanceDetailPath(record.id),
      date: record.scheduledDate,
    });
  }

  for (const record of repairs) {
    if (!isOpenRepair(record)) continue;

    notifications.push({
      id: `repair-${record.id}:${record.status}`,
      tone: 'repair',
      title: 'Open repair',
      description: `${record.machineCode} — ${record.description}`,
      href: repairDetailPath(record.id),
      date: record.reportedDate,
    });
  }

  return notifications
    .sort((a, b) => {
      const byTone = toneRank[a.tone] - toneRank[b.tone];
      if (byTone !== 0) return byTone;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    })
    .slice(0, limit);
}
