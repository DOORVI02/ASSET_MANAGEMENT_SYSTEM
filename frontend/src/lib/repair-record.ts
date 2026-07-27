import type { RepairRecord } from './types';

export function isOpenRepair(record: RepairRecord): boolean {
  return record.status !== 'completed' && record.status !== 'cancelled';
}

export const repairStatusLabels: Record<RepairRecord['status'], string> = {
  reported: 'Reported',
  in_progress: 'In progress',
  waiting_for_parts: 'Waiting for parts',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
