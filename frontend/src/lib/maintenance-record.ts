import { isDueSoon, isOverdue } from './maintenance-window';
import type { DueState, MaintenanceRecord } from './types';

/** A record still awaiting or undergoing work; not yet closed out. */
export function isOpenMaintenance(record: MaintenanceRecord): boolean {
  return record.status === 'scheduled' || record.status === 'in_progress';
}

/**
 * Due state of a maintenance record, derived from `scheduledDate`.
 *
 * Only open records have a due state — a completed or cancelled record is closed and
 * `not_applicable`, never "overdue", so history does not accumulate false alarms.
 */
export function maintenanceDueState(record: MaintenanceRecord, now: number = Date.now()): DueState {
  if (!isOpenMaintenance(record)) return 'not_applicable';
  if (isOverdue(record.scheduledDate, now)) return 'overdue';
  if (isDueSoon(record.scheduledDate, now)) return 'due_soon';
  return 'ok';
}

export const maintenanceStatusLabels: Record<MaintenanceRecord['status'], string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
