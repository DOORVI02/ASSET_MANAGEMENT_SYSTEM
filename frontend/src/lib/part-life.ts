import { DUE_SOON_WINDOW_DAYS, daysUntil } from './maintenance-window';
import type { MachinePart, PartLifeState } from './types';

/**
 * Derives when a fitted component is due for replacement.
 *
 * Life state is never stored: it follows from `fittedDate` plus `expectedLifeMonths`,
 * so it cannot contradict the stored inputs. The due-soon threshold is the same
 * 15-day window the maintenance pages use, so "due soon" means one thing app-wide.
 */
export function replacementDueDate(part: MachinePart): string | null {
  if (!part.expectedLifeMonths || part.expectedLifeMonths <= 0) return null;

  const fitted = new Date(part.fittedDate);
  if (Number.isNaN(fitted.getTime())) return null;

  const due = new Date(fitted);
  due.setMonth(due.getMonth() + part.expectedLifeMonths);
  return due.toISOString();
}

export function partLifeState(part: MachinePart, now: number = Date.now()): PartLifeState {
  const due = replacementDueDate(part);
  if (!due) return 'unknown';

  const days = daysUntil(due, now);
  if (Number.isNaN(days)) return 'unknown';
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_WINDOW_DAYS) return 'due_soon';
  return 'ok';
}

export const partLifeLabels: Record<PartLifeState, string> = {
  unknown: 'No life set',
  ok: 'In service',
  due_soon: 'Replacement due',
  overdue: 'Replacement overdue',
};
