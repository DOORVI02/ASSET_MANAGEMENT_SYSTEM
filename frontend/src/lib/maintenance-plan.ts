import { isDueSoon, isOverdue } from './maintenance-window';
import type { DueState, MaintenancePlan, RecurrenceUnit } from './types';

/** Adds one recurrence interval to a date without mutating it. */
export function addInterval(date: Date, value: number, unit: RecurrenceUnit): Date {
  const next = new Date(date);
  switch (unit) {
    case 'days':
      next.setDate(next.getDate() + value);
      break;
    case 'weeks':
      next.setDate(next.getDate() + value * 7);
      break;
    case 'months':
      next.setMonth(next.getMonth() + value);
      break;
    case 'years':
      next.setFullYear(next.getFullYear() + value);
      break;
  }
  return next;
}

/**
 * Next due date for a recurring plan: the last completion plus the interval, or the
 * plan's creation date plus the interval if it has never been completed. Never
 * stored — recomputed from `lastCompletedDate`/`createdAt` so it cannot drift.
 */
export function planNextDueDate(plan: MaintenancePlan): string {
  const base = new Date(plan.lastCompletedDate ?? plan.createdAt);
  return addInterval(base, plan.intervalValue, plan.intervalUnit).toISOString();
}

/** An inactive or archived plan has no meaningful due state. */
export function planDueState(plan: MaintenancePlan, now: number = Date.now()): DueState {
  if (!plan.isActive || plan.isArchived) return 'not_applicable';
  const due = planNextDueDate(plan);
  if (isOverdue(due, now)) return 'overdue';
  if (isDueSoon(due, now)) return 'due_soon';
  return 'ok';
}

export function formatInterval(value: number, unit: RecurrenceUnit): string {
  const singular: Record<RecurrenceUnit, string> = {
    days: 'day',
    weeks: 'week',
    months: 'month',
    years: 'year',
  };
  return `Every ${value} ${value === 1 ? singular[unit] : unit}`;
}
